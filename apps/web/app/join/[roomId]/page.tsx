"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { formatUnits, parseUnits } from "viem";
import { useConnection, usePublicClient, useReadContract, useWriteContract } from "wagmi";
import { WalletBar } from "@/components/WalletBar";
import { Skeleton } from "@/components/ui/skeleton";
import { DICE_BATTLE_ABI } from "@/lib/abi";
import { ERC20_ABI, GAME_ADDRESS, ROOM_STATE, ROOM_STATE_LABEL } from "@/lib/constants";
import { truncateAddress, getTokenSymbol } from "@/lib/utils";
import { useErrorToast } from "@/hooks/useErrorToast";
import { logger } from "@/lib/logger";
import { Spinner } from "@/components/ui/spinner";
import { SecretBackupModal, hasSeenBackup } from "@/components/game/SecretBackupModal";
import { loadSecret } from "@/lib/commitment";

type Room = {
  playerA: `0x${string}`;
  playerB: `0x${string}`;
  token: `0x${string}`;
  stake: bigint;
  state: number;
};


export default function JoinRoomPage() {
  const params = useParams<{ roomId: string }>();
  const router = useRouter();
  const { address, isConnected } = useConnection();
  const publicClient = usePublicClient();
  const { mutateAsync: writeContractAsync } = useWriteContract();

  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useErrorToast();
  const [showBackup, setShowBackup] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: tokenDecimals } = useReadContract({
    address: room?.token,
    abi: ERC20_ABI,
    functionName: "decimals",
    query: { enabled: !!room?.token },
  });

  const { data: currentAllowance, refetch: refetchAllowance } = useReadContract({
    address: room?.token,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: [address!, GAME_ADDRESS],
    query: { enabled: !!address && !!room?.token },
  });

  function isAllowanceReady(allowance: bigint | undefined) {
    return room?.stake &&
      tokenDecimals != null &&
      allowance != null &&
      allowance >= room?.stake;
  }

  let allowanceReady = isAllowanceReady(currentAllowance);

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
    logger.log("[join] Cargando sala roomId:", params.roomId);
    fetchRoom()
      .then((r) => {
        if (r) {
          setRoom(r);
          logger.log("[join] Sala cargada — state:", r.state, "| playerA:", r.playerA, "| stake:", r.stake.toString());
        }
      })
      .catch((e: unknown) => {
        logger.error("[join] Error cargando sala:", e instanceof Error ? e.message : String(e));
        setError(e);
      })
      .finally(() => setLoading(false));
  }, [fetchRoom, publicClient, params.roomId]);

  // Show backup modal for PlayerA if they haven't seen it and secret still exists
  useEffect(() => {
    if (!room || !address || loading) return;
    const isA = address.toLowerCase() === room.playerA.toLowerCase();
    if (isA && !hasSeenBackup(params.roomId) && !!loadSecret(params.roomId)) {
      setShowBackup(true);
    }
  }, [room, address, loading, params.roomId]);

  // Poll every 4s while state=Open so Player A sees when Player B joins
  useEffect(() => {
    if (!room || room.state !== ROOM_STATE.OPEN || busy) return;
    logger.log("[join] Iniciando polling — esperando que alguien una la sala");

    pollingRef.current = setInterval(async () => {
      try {
        const updated = await fetchRoom();
        if (!updated) return;
        if (updated.state !== room.state) {
          logger.log("[join] Estado cambió:", room.state, "→", updated.state);
        }
        setRoom(updated);
        if (updated.state !== ROOM_STATE.OPEN) {
          logger.log("[join] Sala ya no está Open — deteniendo polling");
          clearInterval(pollingRef.current!);
          pollingRef.current = null;
          if (updated.state === ROOM_STATE.MATCHED) {
            router.push(`/game/${params.roomId}`);
          }
        }
      } catch {
        // ignore poll errors
      }
    }, 4000);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [room?.state, busy, fetchRoom]);

  async function onJoin() {
    logger.log("[onJoin] Iniciando join — wallet:", address, "| roomId:", params.roomId);
    if (!address || !publicClient || !room) return;
    setBusy(true);

    try {
      // 1. Approve if needed
      logger.log("[onJoin] [1/2] Consultando allowance del ERC20...");
      const allowance = (await publicClient.readContract({
        address: room.token,
        abi: ERC20_ABI,
        functionName: "allowance",
        args: [address, GAME_ADDRESS],
      })) as bigint;
      logger.log("[onJoin] Allowance actual:", allowance.toString(), "| Stake requerido:", room.stake.toString());

      if (allowance < room.stake) {
        logger.log("[onJoin] Allowance insuficiente — enviando approve...");
        const approveHash = await writeContractAsync({
          address: room.token,
          abi: ERC20_ABI,
          functionName: "approve",
          args: [GAME_ADDRESS, room.stake],
        });
        logger.log("[onJoin] Tx approve enviada:", approveHash);
        await publicClient.waitForTransactionReceipt({ hash: approveHash });
        await new Promise((resolve) => setTimeout(resolve, 2000)); // Espera extra para indexación (ajustar según red)
        const { data: freshAllowance } = await refetchAllowance();
        isAllowanceReady(freshAllowance)
        logger.log("[onJoin] Approve confirmado");
      } else {
        logger.log("[onJoin] Allowance suficiente — omitiendo approve");
      }

      // 2. Join room
      logger.log("[onJoin] [2/2] Enviando joinRoom al contrato...");
      const joinHash = await writeContractAsync({
        address: GAME_ADDRESS,
        abi: DICE_BATTLE_ABI,
        functionName: "joinRoom",
        args: [BigInt(params.roomId)],
      });
      logger.log("[onJoin] Tx joinRoom enviada:", joinHash);
      const receipt = await publicClient.waitForTransactionReceipt({ hash: joinHash });
      logger.log("[onJoin] Tx confirmada — bloque:", receipt.blockNumber.toString(), "| status:", receipt.status);

      if (receipt.status === "reverted") {
        throw new Error(`Transaction reverted (hash: ${joinHash})`);
      }

      logger.log("[onJoin] Join exitoso — redirigiendo a /game/" + params.roomId);
      router.push(`/game/${params.roomId}`);
    } catch (e) {
      logger.error("[onJoin] Error:", e instanceof Error ? e.message : String(e));
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  if (showBackup) {
    const secret = loadSecret(params.roomId);
    if (secret) {
      return (
        <SecretBackupModal
          roomId={params.roomId}
          secret={secret}
          onDismiss={() => setShowBackup(false)}
        />
      );
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <WalletBar />
        {/* Header */}
        <div className="flex items-center justify-between pt-2">
          <Skeleton className="h-4 w-10" />
          <Skeleton className="h-5 w-24" />
          <div className="w-10" />
        </div>
        {/* Room info card */}
        <div className="rounded-xl bg-white/5 p-4 flex flex-col gap-3">
          <div className="flex justify-between">
            <Skeleton className="h-3 w-8" />
            <Skeleton className="h-3 w-28" />
          </div>
          <div className="flex justify-between">
            <Skeleton className="h-3 w-8" />
            <Skeleton className="h-3 w-20" />
          </div>
          <div className="flex justify-between">
            <Skeleton className="h-3 w-8" />
            <Skeleton className="h-3 w-14" />
          </div>
        </div>
        {/* Action button */}
        <Skeleton className="h-14 w-full rounded-2xl" />
      </div>
    );
  }

  if (!room || room.state === ROOM_STATE.NONE) {
    return (
      <div className="flex flex-col gap-4">
        <WalletBar />
        <Link href="/" className="pt-2 text-sm text-white/60">← Back</Link>
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
          Room #{params.roomId} does not exist.
        </div>
      </div>
    );
  }

  const isPlayerA = address?.toLowerCase() === room.playerA.toLowerCase();
  const isPlayerB = address?.toLowerCase() === room.playerB.toLowerCase();
  const tokenSymbol = getTokenSymbol(room.token);

  return (
    <div className="flex flex-col gap-6">
      <WalletBar />

      <header className="flex items-center justify-between pt-2">
        <Link href="/" className="text-sm text-white/60">← Back</Link>
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
            {formatUnits(room.stake, tokenDecimals ?? 18)} {tokenSymbol}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-white/60">State</span>
          <span className="text-white/80">{ROOM_STATE_LABEL[room.state]}</span>
        </div>
      </section>

      {/* Player A waiting for opponent */}
      {room.state === ROOM_STATE.OPEN && isPlayerA && (
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

      {/* Player B can join */}
      {room.state === ROOM_STATE.OPEN && !isPlayerA && (
        <>
          <div className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-xs ${
            allowanceReady
              ? "border-green-500/20 bg-green-500/5 text-green-400"
              : "border-white/10 bg-white/5 text-white/50"
          }`}>
            <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${allowanceReady ? "bg-green-400" : "bg-white/30"}`} />
            {allowanceReady ? "Ready — 1 transaction to confirm" : "Needs approval + join — 2 transactions"}
          </div>
          <button
          type="button"
          disabled={!isConnected || busy}
          onClick={onJoin}
          className="flex items-center justify-center gap-2 rounded-2xl bg-celo-yellow py-4 text-center font-semibold text-celo-dark active:opacity-80 disabled:opacity-40"
        >
          {
            busy 
              ? (
                  <>
                    <Spinner /> Joining…
                  </>
                )
              : `Match ${formatUnits(room.stake, tokenDecimals ?? 18)} ${tokenSymbol}`}
          </button>
        </>
      )}

      {/* Room matched — go to game */}
      {room.state === ROOM_STATE.MATCHED && (
        <Link
          href={`/game/${params.roomId}`}
          className="rounded-2xl bg-celo-yellow py-4 text-center font-semibold text-celo-dark active:opacity-80"
        >
          Go to game →
        </Link>
      )}

      {/* Game already finished */}
      {(room.state === ROOM_STATE.RESOLVED || room.state === ROOM_STATE.EXPIRED) && (
        <div className="flex flex-col gap-3">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-center text-sm text-white/60">
            {room.state === ROOM_STATE.RESOLVED
              ? "This game has already been resolved."
              : "This game expired — host never revealed."}
            {(isPlayerA || isPlayerB) && (
              <Link
                href={`/game/${params.roomId}`}
                className="mt-2 block text-xs text-celo-yellow underline"
              >
                View result →
              </Link>
            )}
          </div>
          <Link
            href="/create"
            className="rounded-2xl border border-white/15 py-4 text-center font-semibold text-white active:opacity-80"
          >
            Create a new room
          </Link>
        </div>
      )}
    </div>
  );
}
