"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { decodeEventLog, formatUnits, type Hex } from "viem";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { WalletBar } from "@/components/WalletBar";
import { DICE_BATTLE_ABI } from "@/lib/abi";
import { loadSecret, clearSecret } from "@/lib/commitment";
import { GAME_ADDRESS, TOKENS } from "@/lib/constants";

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
  rollA?: number;
  rollB?: number;
  winner?: `0x${string}`;
  payout?: bigint;
};

export default function GamePage() {
  const params = useParams<{ roomId: string }>();
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const [room, setRoom] = useState<Room | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!publicClient || !params.roomId) return;
    const r = (await publicClient.readContract({
      address: GAME_ADDRESS,
      abi: DICE_BATTLE_ABI,
      functionName: "rooms",
      args: [BigInt(params.roomId)],
    })) as readonly [
      `0x${string}`, `0x${string}`, `0x${string}`, bigint, bigint, `0x${string}`, number
    ];
    setRoom({
      playerA: r[0],
      playerB: r[1],
      token: r[2],
      stake: r[3],
      matchedAtBlock: r[4],
      state: r[6],
    });

    // If resolved, fetch result from events
    if (r[6] === 3) {
      const roomId = BigInt(params.roomId);
      const latest = await publicClient.getBlockNumber();
      const logs = await publicClient.getLogs({
        address: GAME_ADDRESS,
        fromBlock: latest > 10_000n ? latest - 10_000n : 0n,
        toBlock: latest,
      });
      for (const log of logs) {
        try {
          const decoded = decodeEventLog({
            abi: DICE_BATTLE_ABI,
            data: log.data,
            topics: log.topics,
          });
          if (
            decoded.eventName === "RoomResolved" &&
            (decoded.args as { roomId: bigint }).roomId === roomId
          ) {
            const args = decoded.args as {
              roomId: bigint;
              winner: `0x${string}`;
              rollA: number;
              rollB: number;
              payout: bigint;
              fee: bigint;
            };
            setResult({
              kind: "win",
              rollA: args.rollA,
              rollB: args.rollB,
              winner: args.winner,
              payout: args.payout,
            });
            return;
          }
          if (
            decoded.eventName === "RoomTied" &&
            (decoded.args as { roomId: bigint }).roomId === roomId
          ) {
            const args = decoded.args as { roomId: bigint; rollA: number; rollB: number };
            setResult({ kind: "tie", rollA: args.rollA, rollB: args.rollB });
            return;
          }
          if (
            decoded.eventName === "RoomExpiredClaim" &&
            (decoded.args as { roomId: bigint }).roomId === roomId
          ) {
            setResult({ kind: "expired" });
            return;
          }
        } catch {
          // not our event
        }
      }
    }
  }, [publicClient, params.roomId]);

  useEffect(() => {
    setLoading(true);
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  const tokenSymbol =
    room?.token.toLowerCase() === TOKENS.cUSD.toLowerCase() ? "cUSD" :
    room?.token.toLowerCase() === TOKENS.USDT.toLowerCase() ? "USDT" :
    "";

  const isPlayerA = address && room && address.toLowerCase() === room.playerA.toLowerCase();
  const isPlayerB = address && room && address.toLowerCase() === room.playerB.toLowerCase();

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
      setError(e instanceof Error ? e.message : String(e));
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
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (loading || !room) {
    return (
      <div className="flex flex-col gap-4 pt-10 text-center text-white/60">
        <WalletBar />
        <p>Loading game…</p>
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

      {/* Dice display */}
      <section className="flex items-center justify-center gap-6 py-8">
        <DieBox value={result?.rollA} label="Host" />
        <div className="text-2xl text-white/40">vs</div>
        <DieBox value={result?.rollB} label="Guest" />
      </section>

      {/* Outcome */}
      {result && (
        <section className="rounded-xl bg-white/5 p-4 text-center">
          {result.kind === "tie" && (
            <>
              <p className="text-lg font-bold text-yellow-400">It's a tie!</p>
              <p className="mt-1 text-xs text-white/60">
                Both players refunded their stake.
              </p>
            </>
          )}
          {result.kind === "win" && youWon && (
            <>
              <p className="text-2xl font-bold text-green-400">You won! 🎉</p>
              <p className="mt-1 font-mono text-sm text-white/80">
                +{formatUnits(result.payout || 0n, 18)} {tokenSymbol}
              </p>
            </>
          )}
          {result.kind === "win" && youLost && (
            <>
              <p className="text-lg font-bold text-red-400">Better luck next time</p>
              <p className="mt-1 text-xs text-white/60">
                Opponent took {formatUnits(result.payout || 0n, 18)} {tokenSymbol}
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

      {/* Actions */}
      {room.state === 2 && (
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
          {isPlayerB && (
            <div className="text-center text-sm text-white/60">
              Waiting for host to reveal…
            </div>
          )}
          {isPlayerB && (
            <button
              type="button"
              disabled={busy}
              onClick={onClaimExpired}
              className="rounded-xl border border-white/15 py-3 text-xs text-white/70 active:opacity-70 disabled:opacity-40"
            >
              Claim expired (after ~200 blocks)
            </button>
          )}
        </section>
      )}

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">
          {error}
        </div>
      )}

      {/* Share new match */}
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

function DieBox({ value, label }: { value?: number; label: string }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-white/15 bg-white/5 text-4xl font-bold font-mono">
        {value ?? "?"}
      </div>
      <div className="text-xs uppercase tracking-wider text-white/50">{label}</div>
    </div>
  );
}
