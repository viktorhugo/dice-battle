"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { formatUnits } from "viem";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { WalletBar } from "@/components/WalletBar";
import { DICE_BATTLE_ABI } from "@/lib/abi";
import { ERC20_ABI, GAME_ADDRESS, TOKENS } from "@/lib/constants";
import { truncateAddress } from "@/lib/utils";

type Room = {
  playerA: `0x${string}`;
  playerB: `0x${string}`;
  token: `0x${string}`;
  stake: bigint;
  state: number;
};

const STATE_LABELS = ["None", "Open", "Matched", "Resolved", "Expired"];

export default function JoinRoomPage() {
  const params = useParams<{ roomId: string }>();
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { mutateAsync: writeContractAsync } = useWriteContract();

  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchRoom = useCallback(async () => {
    if (!publicClient || !params.roomId) return null;
    const result = (await publicClient.readContract({
      address: GAME_ADDRESS,
      abi: DICE_BATTLE_ABI,
      functionName: "rooms",
      args: [BigInt(params.roomId)],
    })) as readonly [
      `0x${string}`, `0x${string}`, `0x${string}`, bigint, bigint, `0x${string}`, number
    ];
    return {
      playerA: result[0],
      playerB: result[1],
      token: result[2],
      stake: result[3],
      state: result[6],
    } as Room;
  }, [publicClient, params.roomId]);

  // Initial load
  useEffect(() => {
    if (!publicClient || !params.roomId) return;
    fetchRoom()
      .then((r) => { if (r) setRoom(r); })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [fetchRoom, publicClient, params.roomId]);

  // Poll every 4s while state=Open so Player A sees when Player B joins
  useEffect(() => {
    if (!room || room.state !== 1 || busy) return;

    pollingRef.current = setInterval(async () => {
      try {
        const updated = await fetchRoom();
        if (!updated) return;
        setRoom(updated);
        if (updated.state !== 1) {
          clearInterval(pollingRef.current!);
          pollingRef.current = null;
        }
      } catch {
        // ignore poll errors
      }
    }, 4000);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [room?.state, busy, fetchRoom]);

  const tokenSymbol =
    room?.token.toLowerCase() === TOKENS.cUSD.toLowerCase() ? "cUSD" :
    room?.token.toLowerCase() === TOKENS.USDT.toLowerCase() ? "USDT" :
    "UNKNOWN";

  async function onJoin() {
    if (!address || !publicClient || !room) return;
    setBusy(true);
    setError(null);

    try {
      // 1. Approve if needed
      const allowance = (await publicClient.readContract({
        address: room.token,
        abi: ERC20_ABI,
        functionName: "allowance",
        args: [address, GAME_ADDRESS],
      })) as bigint;

      if (allowance < room.stake) {
        const approveHash = await writeContractAsync({
          address: room.token,
          abi: ERC20_ABI,
          functionName: "approve",
          args: [GAME_ADDRESS, room.stake],
        });
        await publicClient.waitForTransactionReceipt({ hash: approveHash });
      }

      // 2. Join room
      const joinHash = await writeContractAsync({
        address: GAME_ADDRESS,
        abi: DICE_BATTLE_ABI,
        functionName: "joinRoom",
        args: [BigInt(params.roomId)],
      });
      await publicClient.waitForTransactionReceipt({ hash: joinHash });

      router.push(`/game/${params.roomId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-4 pt-10 text-center text-white/60">
        <WalletBar />
        <p>Loading room…</p>
      </div>
    );
  }

  if (!room || room.state === 0) {
    return (
      <div className="flex flex-col gap-4">
        <WalletBar />
        <Link href="/" className="pt-2 text-sm text-white/60">
          ← Back
        </Link>
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
          Room #{params.roomId} does not exist.
        </div>
      </div>
    );
  }

  const isPlayerA = address?.toLowerCase() === room.playerA.toLowerCase();

  return (
    <div className="flex flex-col gap-6">
      <WalletBar />

      <header className="flex items-center justify-between pt-2">
        <Link href="/" className="text-sm text-white/60">
          ← Back
        </Link>
        <h1 className="text-lg font-semibold">Room #{params.roomId}</h1>
        <div className="w-10" />
      </header>

      <section className="rounded-xl bg-white/5 p-4 text-sm">
        <div className="flex justify-between">
          <span className="text-white/60">Host</span>
          <span className="font-mono text-white/80">{truncateAddress(room.playerA)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-white/60">Stake</span>
          <span className="font-mono text-white/80">
            {formatUnits(room.stake, 18)} {tokenSymbol}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-white/60">State</span>
          <span className="text-white/80">{STATE_LABELS[room.state]}</span>
        </div>
      </section>

      {room.state === 1 && isPlayerA && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
          <p>You created this room. Share the link with your opponent.</p>
          <p className="mt-1 text-xs text-white/40 animate-pulse">Waiting for someone to join…</p>
          <button
            type="button"
            onClick={() => navigator.clipboard?.writeText(window.location.href)}
            className="mt-2 block w-full rounded-lg border border-white/10 py-2 text-xs text-white active:opacity-70"
          >
            Copy link
          </button>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">
          {error}
        </div>
      )}

      {room.state === 1 && !isPlayerA && (
        <button
          type="button"
          disabled={!isConnected || busy}
          onClick={onJoin}
          className="rounded-2xl bg-celo-yellow py-4 text-center font-semibold text-celo-dark active:opacity-80 disabled:opacity-40"
        >
          {busy ? "Joining…" : `Match ${formatUnits(room.stake, 18)} ${tokenSymbol}`}
        </button>
      )}

      {room.state === 2 && (
        <Link
          href={`/game/${params.roomId}`}
          className="rounded-2xl bg-celo-yellow py-4 text-center font-semibold text-celo-dark active:opacity-80"
        >
          Go to game →
        </Link>
      )}
    </div>
  );
}
