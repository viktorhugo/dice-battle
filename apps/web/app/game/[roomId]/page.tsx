"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { formatUnits, type Hex } from "viem";
import { useConnection, usePublicClient, useReadContract, useWriteContract } from "wagmi";
import { WalletBar } from "@/components/WalletBar";
import { Skeleton } from "@/components/ui/skeleton";
import { DicePair } from "@/components/game/DiceAnimation";
import { DICE_BATTLE_ABI } from "@/lib/abi";
import { loadSecret, clearSecret, storeSecret } from "@/lib/commitment";
import { ERC20_ABI, GAME_ADDRESS, ROOM_STATE, SHOW_BLOCK_COUNTDOWN } from "@/lib/constants";
import {
  getPlayerMiniStats,
  getHeadToHead,
  getRoomCreatedAt,
  type PlayerMiniStats,
  type H2HSummary,
} from "@/lib/indexer";
import Image from "next/image";
import { Dices } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { getTokenSymbol, getTokenIcon, truncateAddress, formatDate, timeAgo } from "@/lib/utils";
import { useErrorToast } from "@/hooks/useErrorToast";
import { useFireworks } from "@/hooks/useFireworks";
import { useAshes } from "@/hooks/useAshes";
import { useTieClash } from "@/hooks/useTieClash";
import { SoftBlurText } from "@/components/ui/SoftBlurText";
import { logger } from "@/lib/logger";

const CELO_SECS_PER_BLOCK = 5;
const REVEAL_WINDOW_BLOCKS = 17_280n; // 24 h on Celo Mainnet (5 s/block)

type Room = {
  playerA: `0x${string}`;
  playerB: `0x${string}`;
  token: `0x${string}`;
  stake: bigint;
  matchedAtBlock: bigint;
  state: number;
};

type Result = {
  kind: "win" | "tie" | "expired";
  rollA1?: number;
  rollA2?: number;
  rollB1?: number;
  rollB2?: number;
  winner?: `0x${string}`;
  payout?: bigint;
};

export default function GamePage() {
  const params = useParams<{ roomId: string }>();
  const { address, isConnected } = useConnection();
  const publicClient = usePublicClient();
  const { mutateAsync: writeContractAsync } = useWriteContract();

  const [room, setRoom] = useState<Room | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [currentBlock, setCurrentBlock] = useState<bigint>(0n);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [shared, setShared] = useState(false);
  const [manualSecret, setManualSecret] = useState("");
  const [error, setError] = useErrorToast();
  const fireFireworks = useFireworks();
  const fallAshes = useAshes();
  const clashTie = useTieClash();

  const celebrationFiredRef = useRef(false);
  useEffect(() => {
    if (celebrationFiredRef.current || !result) return;

    const won = result.kind === "win" && result.winner?.toLowerCase() === address?.toLowerCase();
    const lost = result.kind === "win" && result.winner?.toLowerCase() !== address?.toLowerCase();
    const tied = result.kind === "tie";

    if (won || lost || tied) {
      celebrationFiredRef.current = true;
      const effect = won ? fireFireworks : tied ? clashTie : fallAshes;
      const t = setTimeout(effect, 1400);
      return () => clearTimeout(t);
    }
  }, [result, address, fireFireworks, fallAshes, clashTie]);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [hostStats, setHostStats] = useState<PlayerMiniStats | null>(null);
  const [guestStats, setGuestStats] = useState<PlayerMiniStats | null>(null);
  const [h2h, setH2H] = useState<H2HSummary | null>(null);
  const [createdAt, setCreatedAt] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    if (!publicClient || !params.roomId) return;
      const r = (
        await publicClient.readContract({
        address: GAME_ADDRESS,
        abi: DICE_BATTLE_ABI,
        functionName: "rooms",
        args: [BigInt(params.roomId)],
      })
    ) as readonly [
      `0x${string}`, `0x${string}`, `0x${string}`, bigint, bigint, `0x${string}`, number
    ];
    const updated: Room = {
      playerA: r[0],
      playerB: r[1],
      token: r[2],
      stake: r[3],
      matchedAtBlock: r[4],
      state: r[6],
    };
    setRoom(updated);

    // Always track current block (needed for reveal window countdown)
    const latest = await publicClient.getBlockNumber();
    setCurrentBlock(latest);

    // Fetch result events for Resolved (3) or Expired (4)
    if (r[6] === ROOM_STATE.RESOLVED || r[6] === ROOM_STATE.EXPIRED) {
      const roomId = BigInt(params.roomId);
      const fromBlock = r[4] > 0n ? r[4] : 0n;

      const [resolvedLogs, tiedLogs, expiredLogs, cancelledLogs] = await Promise.all([
        publicClient.getContractEvents({ address: GAME_ADDRESS, abi: DICE_BATTLE_ABI, eventName: "RoomResolved", args: { roomId }, fromBlock, toBlock: latest }),
        publicClient.getContractEvents({ address: GAME_ADDRESS, abi: DICE_BATTLE_ABI, eventName: "RoomTied", args: { roomId }, fromBlock, toBlock: latest }),
        publicClient.getContractEvents({ address: GAME_ADDRESS, abi: DICE_BATTLE_ABI, eventName: "RoomExpiredClaim", args: { roomId }, fromBlock, toBlock: latest }),
        publicClient.getContractEvents({ address: GAME_ADDRESS, abi: DICE_BATTLE_ABI, eventName: "RoomCancelled", args: { roomId }, fromBlock, toBlock: latest }),
      ]);

      if (resolvedLogs.length > 0) {
        const { rollA1, rollA2, rollB1, rollB2, winner, payout } = resolvedLogs[0].args;
        setResult({ kind: "win", rollA1, rollA2, rollB1, rollB2, winner, payout });
        return;
      }
      if (tiedLogs.length > 0) {
        const { rollA1, rollA2, rollB1, rollB2 } = tiedLogs[0].args;
        setResult({ kind: "tie", rollA1, rollA2, rollB1, rollB2 });
        return;
      }
      if (expiredLogs.length > 0 || cancelledLogs.length > 0) {
        setResult({ kind: "expired" });
        return;
      }
    }
  }, [publicClient, params.roomId]);

  useEffect(() => {
    setLoading(true);
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  // Load player stats and H2H once both players are known
  useEffect(() => {
    if (!room?.playerB) return;

    void Promise.allSettled([
      getPlayerMiniStats(room.playerA).then(setHostStats),
      getPlayerMiniStats(room.playerB).then(setGuestStats),
      getRoomCreatedAt(params.roomId).then(setCreatedAt),
      address
        ? getHeadToHead(address, address.toLowerCase() === room.playerA.toLowerCase()
            ? room.playerB
            : room.playerA).then(setH2H)
        : Promise.resolve(),
    ]).then((results) => {
      results.forEach((r) => {
        if (r.status === "rejected") logger.error("[game] indexer fetch:", r.reason);
      });
    });
  }, [room?.playerA, room?.playerB, address, params.roomId]);

  // Poll every 4s while Matched (state=2) so both players see result automatically
  useEffect(() => {
    if (!room || room.state !== ROOM_STATE.MATCHED || busy) return;

    pollingRef.current = setInterval(async () => {
      try {
        await refresh();
      } catch {
        // ignore poll errors
      }
    }, 4000);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [room?.state, busy, refresh]);

  // Stop polling once resolved/expired
  useEffect(() => {
    if (room && room.state !== ROOM_STATE.MATCHED && pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, [room?.state]);

  const { data: tokenDecimals } = useReadContract({
    address: room?.token,
    abi: ERC20_ABI,
    functionName: "decimals",
    query: { enabled: !!room?.token },
  });

  const tokenSymbol = room ? getTokenSymbol(room.token) : "";
  const tokenIcon   = room ? getTokenIcon(room.token) : "";
  const ZERO_ADDR   = "0x0000000000000000000000000000000000000000";
  const hasGuest    = room?.playerB && room.playerB !== ZERO_ADDR;

  const hasSecret = !!loadSecret(params.roomId);
  const isPlayerA = (address && room && address.toLowerCase() === room.playerA.toLowerCase()) || (hasSecret && room?.state === ROOM_STATE.MATCHED);
  const isPlayerB = address && room && address.toLowerCase() === room.playerB.toLowerCase();

  // How many blocks until the claim window opens (negative = already expired)
  const blocksUntilExpiry = room && currentBlock > 0n
    ? Number(room.matchedAtBlock + REVEAL_WINDOW_BLOCKS - currentBlock)
    : null;
  const canClaim = blocksUntilExpiry !== null && blocksUntilExpiry <= 0;

  // Human-readable time remaining for Player B
  const secsUntilClaim = blocksUntilExpiry !== null ? Math.max(0, blocksUntilExpiry * CELO_SECS_PER_BLOCK) : null;
  const revealTimeLabel = secsUntilClaim !== null && secsUntilClaim > 0
    ? secsUntilClaim >= 3600
      ? `~${Math.floor(secsUntilClaim / 3600)}h ${Math.floor((secsUntilClaim % 3600) / 60)}m`
      : `~${Math.max(1, Math.floor(secsUntilClaim / 60))}m`
    : null;

  async function onReveal() {
    if (!room || !publicClient) return;
    const secret = loadSecret(params.roomId);
    if (!secret) {
      setError("Could not find your secret locally. It must be on the device you used to create the room.");
      return;
    }
    setBusy(true);
    try {
      const hash = await writeContractAsync({
        address: GAME_ADDRESS,
        abi: DICE_BATTLE_ABI,
        functionName: "reveal",
        args: [BigInt(params.roomId), secret as Hex],
      });
      await publicClient.waitForTransactionReceipt({ hash });
      clearSecret(params.roomId);
      await refresh();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  async function onClaimExpired() {
    if (!publicClient) return;
    setBusy(true);
    setError(null);
    try {
      const hash = await writeContractAsync({
        address: GAME_ADDRESS,
        abi: DICE_BATTLE_ABI,
        functionName: "claimExpired",
        args: [BigInt(params.roomId)],
      });
      await publicClient.waitForTransactionReceipt({ hash });
      await refresh();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  if (loading || !room) {
    return (
      <div className="flex flex-col gap-6">
        <WalletBar />
        {/* Header */}
        <div className="flex items-center justify-between pt-2">
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-5 w-24" />
          <div className="w-10" />
        </div>
        {/* Dice area */}
        <div className="flex items-center justify-center gap-4 py-8">
          <div className="flex flex-col items-center gap-2">
            <div className="flex gap-2">
              <Skeleton className="h-16 w-16 rounded-2xl" />
              <Skeleton className="h-16 w-16 rounded-2xl" />
            </div>
            <Skeleton className="h-3 w-10" />
          </div>
          <Skeleton className="h-6 w-6 rounded-full" />
          <div className="flex flex-col items-center gap-2">
            <div className="flex gap-2">
              <Skeleton className="h-16 w-16 rounded-2xl" />
              <Skeleton className="h-16 w-16 rounded-2xl" />
            </div>
            <Skeleton className="h-3 w-10" />
          </div>
        </div>
        {/* Action button */}
        <Skeleton className="h-14 w-full rounded-2xl" />
      </div>
    );
  }

  const youWon = result?.kind === "win" && result.winner?.toLowerCase() === address?.toLowerCase();
  const youLost = result?.kind === "win" && result.winner?.toLowerCase() !== address?.toLowerCase();

  return (
    <div className="flex flex-col gap-5 pb-10">
      <WalletBar />

      {/* Header */}
      <header className="flex items-center justify-between pt-2">
        <Link href="/" className="text-sm text-white/40 transition-colors hover:text-white/70">
          ← Home
        </Link>
        <h1 className="font-heading text-base font-semibold tracking-wide">
          Room <span style={{ color: "#FCFF52" }}>#{params.roomId}</span>
        </h1>
        {room.state === ROOM_STATE.MATCHED ? (
          <div className="flex items-center gap-1 rounded-full border border-green-500/20 bg-green-500/10 px-2 py-0.5">
            <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
            <span className="font-mono text-[9px] text-green-400 uppercase tracking-widest">Live</span>
          </div>
        ) : (
          <div className="w-10" />
        )}
      </header>

      {/* Created at row */}
      {createdAt && (
        <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 backdrop-blur-sm">
          <span className="text-[10px] uppercase tracking-widest text-white/25 font-heading">Room created</span>
          <span className="font-mono text-xs text-white/50">
            {formatDate(createdAt)} <span className="text-white/30">({timeAgo(createdAt)})</span>
          </span>
        </div>
      )}

      {/* Dice arena */}
      <section className="relative rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm px-4 pt-5 pb-5 flex flex-col gap-4">
        {/* Ambient glows */}
        <div aria-hidden className="pointer-events-none absolute left-[10%] top-1/2 -translate-y-1/2 h-28 w-28 rounded-full blur-3xl opacity-20" style={{ background: "#FCFF52" }} />
        <div aria-hidden className="pointer-events-none absolute right-[10%] top-1/2 -translate-y-1/2 h-28 w-28 rounded-full blur-3xl opacity-15" style={{ background: "#00C4B3" }} />

        {/* Dice + player info */}
        <div className="relative flex items-center justify-center gap-4">
          {/* Host side */}
          <div className="flex flex-col items-center gap-2">
            <DicePair roll1={result?.rollA1} roll2={result?.rollA2} label="HOST" delay={0} />
            <span className="font-mono text-[9px] text-white/35">{truncateAddress(room.playerA)}</span>
            {hostStats && (() => {
              const total = hostStats.wins + hostStats.losses + hostStats.ties;
              const wr = total > 0 ? Math.round((hostStats.wins / total) * 100) : 0;
              return (
                <span className="font-mono text-[9px] text-white/30">
                  <span className="text-green-400">{hostStats.wins}W</span>
                  {" · "}
                  <span className="text-red-400">{hostStats.losses}L</span>
                  {total > 0 && <> · {wr}%</>}
                  {hostStats.currentStreak >= 3 && <span className="text-orange-400"> 🔥{hostStats.currentStreak}</span>}
                </span>
              );
            })()}
            <span className={`rounded-full px-2 py-0.5 font-heading text-[9px] font-semibold tracking-wide ${isPlayerA ? "border border-[#FCFF52]/30 bg-[#FCFF52]/10" : "invisible"}`} style={{ color: "#FCFF52" }}>
              YOU
            </span>
          </div>

          <span className="font-heading text-lg font-bold text-white/20 mb-6">VS</span>

          {/* Guest side */}
          <div className="flex flex-col items-center gap-2">
            <DicePair roll1={result?.rollB1} roll2={result?.rollB2} label="GUEST" delay={200} />
            {hasGuest
              ? <span className="font-mono text-[9px] text-white/35">{truncateAddress(room.playerB)}</span>
              : <span className="font-mono text-[9px] text-white/20">waiting…</span>
            }
            {guestStats && (() => {
              const total = guestStats.wins + guestStats.losses + guestStats.ties;
              const wr = total > 0 ? Math.round((guestStats.wins / total) * 100) : 0;
              return (
                <span className="font-mono text-[9px] text-white/30">
                  <span className="text-green-400">{guestStats.wins}W</span>
                  {" · "}
                  <span className="text-red-400">{guestStats.losses}L</span>
                  {total > 0 && <> · {wr}%</>}
                  {guestStats.currentStreak >= 3 && <span className="text-orange-400">🔥{guestStats.currentStreak} </span>}
                </span>
              );
            })()}
            <span className={`rounded-full px-2 py-0.5 font-heading text-[9px] font-semibold tracking-wide ${isPlayerB ? "border border-[#00C4B3]/30 bg-[#00C4B3]/10" : "invisible"}`} style={{ color: "#00C4B3" }}>
              YOU
            </span>
          </div>
        </div>
      </section>

      {/* Outcome */}
      {result && (
        <section className="rounded-2xl border border-white/10 bg-white/5 p-5 text-center backdrop-blur-sm">
          {result.kind === "tie" && (
            <>
              <p className="font-heading text-xl font-bold" style={{ color: "#FCFF52" }}>It&apos;s a tie!</p>
              <p className="mt-1 font-mono text-sm text-white/70">
                +{formatUnits(room.stake, tokenDecimals ?? 18)} {tokenSymbol} refunded
              </p>
            </>
          )}
          {result.kind === "win" && youWon && (
            <>
              <p className="font-heading text-2xl font-bold text-green-400">You won!</p>
              <p className="mt-1 font-mono text-sm text-white/80">
                +{formatUnits(result.payout || 0n, tokenDecimals ?? 18)} {tokenSymbol}
              </p>
            </>
          )}
          {result.kind === "win" && youLost && (
            <>
              <p className="font-heading text-xl font-bold text-red-400">Better luck next time</p>
              <p className="mt-1 text-xs text-white/50">
                Opponent took {formatUnits(result.payout || 0n, tokenDecimals ?? 18)} {tokenSymbol}
              </p>
            </>
          )}
          {result.kind === "expired" && (
            <>
              <p className="font-heading text-xl font-bold text-white/70">Claimed as expired</p>
              <p className="mt-1 text-xs text-white/40">Host did not reveal in time.</p>
            </>
          )}
        </section>
      )}

      {/* Prize + stake info — while waiting */}
      {room.state === ROOM_STATE.MATCHED && tokenDecimals != null && (
        <div className="flex flex-col gap-2">
          {/* Prize card — watermark a la derecha, info a la izquierda */}
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 px-4 py-4 backdrop-blur-sm">
            {/* Token watermark */}
            {tokenIcon && (
              <Image
                src={tokenIcon}
                alt=""
                width={90}
                height={90}
                className="pointer-events-none absolute -right-[45px] top-1/2 -translate-y-1/2 select-none opacity-60"
                aria-hidden
              />
            )}
            <p className="text-[10px] uppercase tracking-widest text-white/30 font-heading">Prize if you win</p>
            <div className="mt-1.5 flex items-center gap-2">
              {tokenIcon && (
                <Image src={tokenIcon} alt={tokenSymbol} width={20} height={20} className="rounded-full" />
              )}
              <p className="font-mono text-2xl font-bold" style={{ color: "#FCFF52" }}>
                ~{(Number(formatUnits(room.stake, tokenDecimals)) * 1.96).toFixed(2)}
                <span className="ml-1.5 text-base font-normal text-white/50">{tokenSymbol}</span>
              </p>
            </div>
          </div>

          {/* Stake + room meta row */}
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-0.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 backdrop-blur-sm">
              <span className="text-[10px] uppercase tracking-widest text-white/25 font-heading">Each stakes</span>
              <div className="flex items-center gap-1.5 mt-0.5">
                {tokenIcon && (
                  <Image src={tokenIcon} alt={tokenSymbol} width={14} height={14} className="rounded-full" />
                )}
                <span className="font-mono text-sm font-semibold text-white">
                  {formatUnits(room.stake, tokenDecimals)} {tokenSymbol}
                </span>
              </div>
            </div>
            <div className="flex flex-col gap-0.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 backdrop-blur-sm">
              <span className="text-[10px] uppercase tracking-widest text-white/25 font-heading">Matched at</span>
              <span className="font-mono text-sm font-semibold text-white/70 mt-0.5">
                Block #{room.matchedAtBlock.toString()}
              </span>
            </div>
          </div>

        </div>
      )}

      {/* Head-to-head */}
      {h2h && h2h.myWins + h2h.theirWins + h2h.ties > 0 && (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-mono">
          <span className="text-white/30">vs opponent:</span>
          <span className="text-green-400">{h2h.myWins}W</span>
          <span className="text-white/20">·</span>
          <span className="text-red-400">{h2h.theirWins}L</span>
          {h2h.ties > 0 && <><span className="text-white/20">·</span><span className="text-yellow-400">{h2h.ties}T</span></>}
        </div>
      )}

      {/* Actions while Matched */}
      {room.state === ROOM_STATE.MATCHED && (
        <section className="flex flex-col gap-3">
          {isPlayerA && hasSecret && (
            <>
              <button
                type="button"
                disabled={!isConnected || busy}
                onClick={onReveal}
                className="group relative overflow-hidden flex items-center justify-center gap-2 rounded-2xl py-[18px] font-heading text-[15px] font-semibold text-[#0C0C0C] transition-transform duration-150 active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none animate-btn-glow"
                style={{ background: "#FCFF52" }}
              >
                <span aria-hidden className="absolute inset-0 bg-black/0 transition-colors duration-150 group-active:bg-black/10" />
                <span className="relative z-10 flex items-center gap-2">
                  {busy ? <Spinner className="h-4 w-4" /> : <Dices className="h-5 w-5" />}
                  {busy ? "Rolling…" : "Reveal and roll"}
                </span>
              </button>
              {canClaim && (
                <p className="text-center text-xs text-red-400/80 font-mono">
                  Claim window open — reveal now or opponent can claim your stake
                </p>
              )}
              {!canClaim && revealTimeLabel && (
                <p className={`text-center text-xs font-mono ${blocksUntilExpiry !== null && blocksUntilExpiry < 720 ? "text-orange-400/70" : "text-white/25"}`}>
                  {blocksUntilExpiry !== null && blocksUntilExpiry < 720 ? `⚠️ Only ${revealTimeLabel} left to reveal` : `${revealTimeLabel} left to reveal`}
                </p>
              )}
            </>
          )}

          {isPlayerA && !hasSecret && (
            <div className="flex flex-col gap-3 rounded-2xl border border-orange-500/30 bg-orange-500/8 p-4 backdrop-blur-sm">
              <div className="flex flex-col gap-1">
                <p className="font-heading text-sm font-semibold text-orange-400">
                  Secret not found on this device
                </p>
                <p className="text-xs leading-relaxed text-orange-400/60">
                  Your room was created on another device. Open that device, go to{" "}
                  <span className="font-mono">My Rooms → Room #{params.roomId}</span> and copy your secret. Then paste it here.
                </p>
              </div>

              <input
                type="text"
                spellCheck={false}
                placeholder="Paste your secret (0x…64 hex chars)"
                value={manualSecret}
                onChange={(e) => setManualSecret(e.target.value.trim())}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 font-mono text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-orange-500/40 transition-colors"
              />

              {(() => {
                const isValid = /^0x[0-9a-fA-F]{64}$/.test(manualSecret);
                return (
                  <button
                    type="button"
                    disabled={!isValid || busy}
                    onClick={() => {
                      storeSecret(params.roomId, manualSecret as Hex);
                      void onReveal();
                    }}
                    className={`group relative overflow-hidden flex items-center justify-center gap-2 rounded-2xl py-[18px] font-heading text-[15px] font-semibold transition-transform duration-150 active:scale-[0.97] disabled:pointer-events-none ${
                      isValid
                        ? "text-[#0C0C0C] animate-btn-glow"
                        : "border border-white/10 bg-white/5 text-white/25"
                    }`}
                    style={isValid ? { background: "#FCFF52" } : undefined}
                  >
                    <span aria-hidden className="absolute inset-0 bg-black/0 transition-colors duration-150 group-active:bg-black/10" />
                    <span className="relative z-10 flex items-center gap-2">
                      {busy ? <Spinner className="h-4 w-4" /> : <Dices className="h-5 w-5" />}
                      {busy ? "Rolling…" : isValid ? "Reveal and roll" : "Paste your secret above"}
                    </span>
                  </button>
                );
              })()}
            </div>
          )}

          {isPlayerB && !canClaim && (
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-white/10 bg-white/5 py-5 text-center backdrop-blur-sm">
              <SoftBlurText text="Waiting for host to reveal…" className="text-sm text-white/50" loop />
              {revealTimeLabel && (
                <p className="text-[10px] font-mono text-white/25">
                  Host has {revealTimeLabel} left — then you can claim
                </p>
              )}
            </div>
          )}

          {isPlayerB && canClaim && (
            <button
              type="button"
              disabled={busy}
              onClick={onClaimExpired}
              className="flex items-center justify-center gap-2 rounded-2xl border border-red-500/30 bg-red-500/10 py-4 text-sm font-semibold text-red-400 active:opacity-70 disabled:opacity-40 transition-opacity"
            >
              {busy ? <><Spinner className="h-4 w-4" />Claiming…</> : "Claim — host didn't reveal in time"}
            </button>
          )}
        </section>
      )}

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">
          {error}
        </div>
      )}

      {result && (
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => {
              const url = `${window.location.origin}/game/${params.roomId}`;
              if (navigator.share) {
                navigator.share({ url, title: `Dice Battle #${params.roomId}` }).catch(() => {});
              } else {
                navigator.clipboard.writeText(url).then(() => {
                  setShared(true);
                  setTimeout(() => setShared(false), 2000);
                });
              }
            }}
            className="flex-1 cursor-pointer rounded-2xl border border-white/10 bg-white/5 py-4 text-center font-heading text-sm font-semibold text-white/70 active:opacity-80 transition-opacity backdrop-blur-sm"
          >
            {shared ? "✓ Copied!" : "Share result"}
          </button>
          <Link
            href="/create"
            className="flex-1 cursor-pointer rounded-2xl py-4 text-center font-heading text-sm font-semibold text-[#0C0C0C] active:opacity-80 animate-btn-glow"
            style={{ background: "#FCFF52" }}
          >
            Play again
          </Link>
        </div>
      )}
    </div>
  );
}
