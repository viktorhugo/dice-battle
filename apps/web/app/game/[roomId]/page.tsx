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
import { loadSecret, clearSecret } from "@/lib/commitment";
import { ERC20_ABI, GAME_ADDRESS, ROOM_STATE, SHOW_BLOCK_COUNTDOWN } from "@/lib/constants";
import {
  getPlayerMiniStats,
  getHeadToHead,
  type PlayerMiniStats,
  type H2HSummary,
} from "@/lib/indexer";
import { getTokenSymbol } from "@/lib/utils";
import { useErrorToast } from "@/hooks/useErrorToast";
import { useFireworks } from "@/hooks/useFireworks";
import { useAshes } from "@/hooks/useAshes";
import { useTieClash } from "@/hooks/useTieClash";
import { SoftBlurText } from "@/components/ui/SoftBlurText";
import { logger } from "@/lib/logger";

const REVEAL_WINDOW = 200n;

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
  }, [room?.playerA, room?.playerB, address]);

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

  const hasSecret = !!loadSecret(params.roomId);
  const isPlayerA = (address && room && address.toLowerCase() === room.playerA.toLowerCase()) || (hasSecret && room?.state === ROOM_STATE.MATCHED);
  const isPlayerB = address && room && address.toLowerCase() === room.playerB.toLowerCase();

  // How many blocks until the claim window opens (negative = already expired)
  const blocksUntilExpiry = room
    ? Number(room.matchedAtBlock + REVEAL_WINDOW - currentBlock)
    : null;
  const canClaim = blocksUntilExpiry !== null && blocksUntilExpiry <= 0;

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
    <div className="flex flex-col gap-6">
      <WalletBar />

      <header className="flex items-center justify-between pt-2">
        <Link href="/" className="text-sm text-white/60">
          ← Home
        </Link>
        <h1 className="text-lg font-semibold">Room #{params.roomId}</h1>
        <div className="w-10" />
      </header>

      {/* Dice display — 2 dice per player */}
      <section className="flex flex-col gap-3 py-6">
        <div className="flex items-center justify-center gap-4">
          <DicePair roll1={result?.rollA1} roll2={result?.rollA2} label="Host" delay={0} />
          <div className="text-2xl text-white/40">vs</div>
          <DicePair roll1={result?.rollB1} roll2={result?.rollB2} label="Guest" delay={200} />
        </div>

        {/* Player records under the dice */}
        {(hostStats || guestStats) && (
          <div className="flex items-start justify-between px-2 text-xs text-white/40">
            {hostStats ? (() => {
              const total = hostStats.wins + hostStats.losses + hostStats.ties;
              const wr = total > 0 ? Math.round((hostStats.wins / total) * 100) : 0;
              return (
                <span>
                  <span className="text-green-400">{hostStats.wins}W</span>
                  {" · "}
                  <span className="text-red-400">{hostStats.losses}L</span>
                  {total > 0 && <> · {wr}%</>}
                  {hostStats.currentStreak >= 3 && (
                    <span className="text-orange-400"> 🔥{hostStats.currentStreak}</span>
                  )}
                </span>
              );
            })() : <span />}

            {guestStats ? (() => {
              const total = guestStats.wins + guestStats.losses + guestStats.ties;
              const wr = total > 0 ? Math.round((guestStats.wins / total) * 100) : 0;
              return (
                <span className="text-right">
                  <span className="text-green-400">{guestStats.wins}W</span>
                  {" · "}
                  <span className="text-red-400">{guestStats.losses}L</span>
                  {total > 0 && <> · {wr}%</>}
                  {guestStats.currentStreak >= 3 && (
                    <span className="text-orange-400">🔥{guestStats.currentStreak} </span>
                  )}
                </span>
              );
            })() : <span />}
          </div>
        )}
      </section>

      {/* Outcome */}
      {result && (
        <section className="rounded-xl bg-white/5 p-4 text-center">
          {result.kind === "tie" && (
            <>
              <p className="text-lg font-bold text-yellow-400">It's a tie!</p>
              <p className="mt-1 font-mono text-sm text-white/80">
                +{formatUnits(room.stake, tokenDecimals ?? 18)} {tokenSymbol} refunded
              </p>
            </>
          )}
          {result.kind === "win" && youWon && (
            <>
              <p className="text-2xl font-bold text-green-400">You won! 🎉</p>
              <p className="mt-1 font-mono text-sm text-white/80">
                +{formatUnits(result.payout || 0n, tokenDecimals ?? 18)} {tokenSymbol}
              </p>
            </>
          )}
          {result.kind === "win" && youLost && (
            <>
              <p className="text-lg font-bold text-red-400">Better luck next time</p>
              <p className="mt-1 text-xs text-white/60">
                Opponent took {formatUnits(result.payout || 0n, tokenDecimals ?? 18)} {tokenSymbol}
              </p>
            </>
          )}
          {result.kind === "expired" && (
            <>
              <p className="text-lg font-bold text-white/80">Claimed as expired</p>
              <p className="mt-1 text-xs text-white/60">Host did not reveal in time.</p>
            </>
          )}
        </section>
      )}

      {/* Prize — visible while waiting for reveal */}
      {room.state === ROOM_STATE.MATCHED && tokenDecimals != null && (
        <div className="flex items-center justify-center gap-2 rounded-xl bg-white/5 py-3 text-center">
          <span className="text-sm text-white/40">Prize:</span>
          <span className="font-mono font-bold text-white">
            ~{(Number(formatUnits(room.stake, tokenDecimals)) * 1.96).toFixed(2)} {tokenSymbol}
          </span>
        </div>
      )}

      {/* Head-to-head — shown after both players are known */}
      {h2h && h2h.myWins + h2h.theirWins + h2h.ties > 0 && (
        <div className="flex items-center justify-center gap-2 text-xs text-white/30">
          <span>Your record vs opponent:</span>
          <span className="text-green-400">{h2h.myWins}W</span>
          <span>·</span>
          <span className="text-red-400">{h2h.theirWins}L</span>
          {h2h.ties > 0 && <><span>·</span><span className="text-yellow-400">{h2h.ties}T</span></>}
        </div>
      )}

      {/* Actions while Matched */}
      {room.state === ROOM_STATE.MATCHED && (
        <section className="flex flex-col gap-3">
          {isPlayerA && (
            <>
              <button
                type="button"
                disabled={!isConnected || busy}
                onClick={onReveal}
                className="rounded-2xl bg-celo-yellow py-4 font-semibold text-celo-dark active:opacity-80 disabled:opacity-40"
              >
                {busy ? "Rolling…" : "Reveal and roll"}
              </button>
              {SHOW_BLOCK_COUNTDOWN && blocksUntilExpiry !== null && blocksUntilExpiry > 0 && (
                <p className={`text-center text-xs ${blocksUntilExpiry < 100 ? "text-orange-400/70" : "text-white/30"}`}>
                  Reveal within ~{blocksUntilExpiry} blocks (~{Math.ceil(blocksUntilExpiry * 5 / 60)} min) or opponent can claim your stake
                </p>
              )}
              {SHOW_BLOCK_COUNTDOWN && canClaim && (
                <p className="text-center text-xs text-red-400/70">
                  Time is up — opponent can now claim your stake. Reveal immediately.
                </p>
              )}
            </>
          )}

          {isPlayerB && (!canClaim || !SHOW_BLOCK_COUNTDOWN) && (
            <div className="flex flex-col items-center gap-1 py-3 text-center">
              <SoftBlurText text="Waiting for host to reveal…" className="text-sm text-white/50" loop />
              {SHOW_BLOCK_COUNTDOWN && blocksUntilExpiry !== null && blocksUntilExpiry > 0 && (
                <p className="text-xs text-white/30">
                  Claim window opens in ~{blocksUntilExpiry} blocks (~{Math.ceil(blocksUntilExpiry * 5 / 60)} min)
                </p>
              )}
            </div>
          )}

          {SHOW_BLOCK_COUNTDOWN && isPlayerB && canClaim && (
            <button
              type="button"
              disabled={busy}
              onClick={onClaimExpired}
              className="rounded-xl border border-white/15 py-3 text-xs text-white/70 active:opacity-70 disabled:opacity-40"
            >
              {busy ? "Claiming…" : "Claim expired — host didn't reveal"}
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
            className="flex-1 rounded-2xl border border-white/15 py-4 text-center font-semibold text-white/80 active:opacity-80"
          >
            {shared ? "✓ Copied!" : "Share result"}
          </button>
          <Link
            href="/create"
            className="flex-1 rounded-2xl border border-white/15 py-4 text-center font-semibold text-white active:opacity-80"
          >
            Play again
          </Link>
        </div>
      )}
    </div>
  );
}
