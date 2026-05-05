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
import { ERC20_ABI, GAME_ADDRESS, ROOM_STATE } from "@/lib/constants";
import { getTokenSymbol } from "@/lib/utils";
import { useErrorToast } from "@/hooks/useErrorToast";

const REVEAL_WINDOW = 900n;

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
  const [error, setError] = useErrorToast();
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  const isPlayerA = address && room && address.toLowerCase() === room.playerA.toLowerCase();
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
    setError(null);
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
      <section className="flex items-center justify-center gap-4 py-8">
        <DicePair roll1={result?.rollA1} roll2={result?.rollA2} label="Host" delay={0} />
        <div className="text-2xl text-white/40">vs</div>
        <DicePair roll1={result?.rollB1} roll2={result?.rollB2} label="Guest" delay={200} />
      </section>

      {/* Outcome */}
      {result && (
        <section className="rounded-xl bg-white/5 p-4 text-center">
          {result.kind === "tie" && (
            <>
              <p className="text-lg font-bold text-yellow-400">It's a tie!</p>
              <p className="mt-1 text-xs text-white/60">Both players refunded their stake.</p>
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

      {/* Actions while Matched */}
      {room.state === ROOM_STATE.MATCHED && (
        <section className="flex flex-col gap-3">
          {isPlayerA && (
            <button
              type="button"
              disabled={!isConnected || busy}
              onClick={onReveal}
              className="rounded-2xl bg-celo-yellow py-4 font-semibold text-celo-dark active:opacity-80 disabled:opacity-40"
            >
              {busy ? "Rolling…" : "Reveal and roll"}
            </button>
          )}

          {isPlayerB && !canClaim && (
            <div className="flex flex-col items-center gap-1 py-3 text-center">
              <p className="text-sm text-white/50 animate-pulse">Waiting for host to reveal…</p>
              {blocksUntilExpiry !== null && blocksUntilExpiry > 0 && (
                <p className="text-xs text-white/30">
                  Claim window opens in ~{blocksUntilExpiry} blocks (~{Math.ceil(blocksUntilExpiry * 5 / 60)} min)
                </p>
              )}
            </div>
          )}

          {isPlayerB && canClaim && (
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
        <Link
          href="/create"
          className="rounded-2xl border border-white/15 py-4 text-center font-semibold text-white active:opacity-80"
        >
          Play again
        </Link>
      )}
    </div>
  );
}
