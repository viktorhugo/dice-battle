"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { formatUnits } from "viem";
import { useConnection, usePublicClient, useReadContract, useWriteContract } from "wagmi";
import { WalletBar } from "@/components/WalletBar";
import { Skeleton } from "@/components/ui/skeleton";
import { SoftBlurText } from "@/components/ui/SoftBlurText";
import { DICE_BATTLE_ABI } from "@/lib/abi";
import { ERC20_ABI, GAME_ADDRESS, ROOM_STATE, ROOM_STATE_LABEL } from "@/lib/constants";
import {
  getPlayerMiniStats,
  getRoomCreatedAt,
  getHeadToHead,
  type PlayerMiniStats,
  type H2HSummary,
} from "@/lib/indexer";
import { getTokenSymbol, getTokenIcon, timeAgo, formatDate } from "@/lib/utils";
import { useErrorToast } from "@/hooks/useErrorToast";
import { useDisplayName } from "@/hooks/useDisplayName";
import { logger } from "@/lib/logger";
import { Spinner } from "@/components/ui/spinner";
import { LightRays } from "@/components/ui/light-rays";
import { CircleSlash } from "lucide-react";
import { FloatingToast } from "@/components/ui/floating-toast";
import { SecretBackupModal, hasSeenBackup } from "@/components/game/SecretBackupModal";
import { loadSecret } from "@/lib/commitment";
import { storeJoinedRoom } from "@/lib/joinedRooms";

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
  const [cancelSuccess, setCancelSuccess] = useState(false);
  const [error, setError] = useErrorToast();
  const [showBackup, setShowBackup] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const hostDisplayName = useDisplayName(room?.playerA);
  const [hostStats, setHostStats] = useState<PlayerMiniStats | null>(null);
  const [createdAt, setCreatedAt] = useState<number | null>(null);
  const [h2h, setH2H] = useState<H2HSummary | null>(null);

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

  const { data: userBalance } = useReadContract({
    address: room?.token,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [address!],
    query: { enabled: !!address && !!room?.token, refetchInterval: 10_000 },
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

  // Load indexer data: host stats, room age, head-to-head (all in parallel)
  useEffect(() => {
    if (!room) return;
    const isOpponent = !!address && address.toLowerCase() !== room.playerA.toLowerCase();

    void Promise.allSettled([
      getPlayerMiniStats(room.playerA).then(setHostStats),
      getRoomCreatedAt(params.roomId).then(setCreatedAt),
      isOpponent
        ? getHeadToHead(address!, room.playerA).then(setH2H)
        : Promise.resolve(),
    ]).then((results) => {
      results.forEach((r) => {
        if (r.status === "rejected") logger.error("[join] indexer fetch:", r.reason);
      });
    });
  }, [room?.playerA, address, params.roomId]);

  // Show backup modal for PlayerA if they haven't seen it and secret still exists
  useEffect(() => {
    if (!room || !address || loading) return;
    const isA = address.toLowerCase() === room.playerA.toLowerCase();
    if (isA && !hasSeenBackup(params.roomId) && !!loadSecret(params.roomId)) {
      setShowBackup(true);
    }
  }, [room, address, loading, params.roomId]);

  // Auto-redirect to /game when room is already MATCHED (e.g. Player A returns after leaving the page)
  useEffect(() => {
    if (loading || !room || room.state !== ROOM_STATE.MATCHED) return;
    // If Player A hasn't backed up the secret yet, let the backup modal show first;
    // the modal's onDismiss will redirect once dismissed.
    if (address) {
      const isA = address.toLowerCase() === room.playerA.toLowerCase();
      if (isA && !!loadSecret(params.roomId) && !hasSeenBackup(params.roomId)) return;
    }
    router.push(`/game/${params.roomId}`);
  }, [loading, room, address, params.roomId, router]);

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

  async function onCancel() {
    if (!publicClient) return;
    setBusy(true);
    try {
      const hash = await writeContractAsync({
        address: GAME_ADDRESS,
        abi: DICE_BATTLE_ABI,
        functionName: "cancelRoom",
        args: [BigInt(params.roomId)],
      });
      await publicClient.waitForTransactionReceipt({ hash });
      setCancelSuccess(true);
      await new Promise((r) => setTimeout(r, 3500));
      router.push("/?cancelled=1");
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

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

      logger.log("[onJoin] Join exitoso — verificando estado en RPC antes de redirigir...");
      let fresh = await fetchRoom();
      let attempts = 0;
      while (fresh?.state !== ROOM_STATE.MATCHED && attempts < 6) {
        await new Promise((r) => setTimeout(r, 1000));
        fresh = await fetchRoom();
        attempts++;
      }
      logger.log("[onJoin] Estado confirmado:", fresh?.state, "— redirigiendo a /game/" + params.roomId);
      storeJoinedRoom(params.roomId);
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
          onDismiss={() => {
            if (room?.state === ROOM_STATE.MATCHED) {
              router.push(`/game/${params.roomId}`);
            } else {
              setShowBackup(false);
            }
          }}
        />
      );
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <WalletBar />
        <div className="flex items-center justify-between pt-2">
          <Skeleton className="h-4 w-10" />
          <Skeleton className="h-5 w-28" />
          <div className="w-10" />
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-7 w-32 rounded-full" />
            <Skeleton className="h-4 w-16" />
          </div>
          <div className="flex flex-col gap-1">
            <Skeleton className="h-3 w-10" />
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-3 w-24" />
          </div>
          <div className="border-t border-zinc-800" />
          <div className="flex justify-between">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-4 w-20" />
          </div>
          <div className="flex justify-between">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-14" />
          </div>
        </div>
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
  const tokenIcon = getTokenIcon(room.token);

  const hasInsufficientBalance = userBalance != null && room.stake > userBalance;
  const balanceFormatted = userBalance != null && tokenDecimals != null
    ? Number(formatUnits(userBalance, tokenDecimals)).toFixed(2)
    : null;

  const cardBorder = tokenSymbol === "USDC"
    ? "border-blue-500/25"
    : tokenSymbol === "USDT"
    ? "border-teal-500/25"
    : "border-[#5118C1]/25";

  const badgeCls = tokenSymbol === "USDC"
    ? "bg-blue-500/15 border border-blue-400/30 text-blue-200"
    : tokenSymbol === "USDT"
    ? "bg-teal-500/15 border border-teal-400/30 text-teal-200"
    : "bg-[#5118C1]/15 border border-[#5118C1]/30 text-purple-200";

  const stateLabel = ROOM_STATE_LABEL[room.state];

  return (
    <div className="flex flex-col gap-5">
      <WalletBar />

      <header className="flex items-center justify-between pt-2">
        <Link href="/rooms" className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors">← Back</Link>
        <h1 className="text-lg font-semibold">Room #{params.roomId}</h1>
        <div className="w-10" />
      </header>

      {/* Main info card */}
      <section className={`relative overflow-hidden rounded-2xl border-2 bg-zinc-900/80 backdrop-blur-md p-5 ${cardBorder}`}>
        <LightRays
          count={5}
          color="rgba(252, 255, 82, 0.18)"
          blur={40}
          speed={16}
          length="100%"
        />
        {/* Token watermark — top-right, 70% visible */}
        <img
          src={tokenIcon}
          alt=""
          aria-hidden
          className="pointer-events-none absolute -right-6 -top-4 h-24 w-24 opacity-[0.4] select-none"
        />

        <div className="relative flex flex-col gap-4">
          
          {/* Host */}
          <div className="flex flex-col gap-0.5">
            <span className="text-[11px] uppercase tracking-wider text-zinc-400">Host</span>
            <p className="text-sm">
              <span className="font-mono text-zinc-200">{hostDisplayName}</span>
            </p>
            {hostStats && (() => {
              const total = hostStats.wins + hostStats.losses + hostStats.ties;
              const wr = total > 0 ? Math.round((hostStats.wins / total) * 100) : 0;
              return (
                <p className="text-xs text-zinc-500">
                  <span className="text-green-400">{hostStats.wins}W</span>
                  {" · "}
                  <span className="text-red-400">{hostStats.losses}L</span>
                  {hostStats.ties > 0 && <> · <span className="text-yellow-400">{hostStats.ties}T</span></>}
                  {total > 0 && <> · {wr}%</>}
                  {hostStats.currentStreak >= 3 && (
                    <span className="text-orange-400"> 🔥{hostStats.currentStreak}</span>
                  )}
                </p>
              );
            })()}
          </div>

          {/* Top row: stake badge + state */}
          <div className="flex items-center justify-between">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${badgeCls}`}>
              <img src={tokenIcon} alt="" className="h-4 w-4" />
              {tokenDecimals != null
                ? formatUnits(room.stake, tokenDecimals)
                : "…"}{" "}{tokenSymbol}
            </span>
            <span className="text-xs text-zinc-400">{stateLabel}</span>
          </div>

          <div className="border-t border-zinc-800" />

          {/* Prize */}
          <div className="flex items-baseline justify-between">
            <span className="text-xs text-zinc-400">Prize if you win</span>
            <span className="font-mono text-sm font-semibold text-green-300">
              ~{tokenDecimals != null
                ? (Number(formatUnits(room.stake, tokenDecimals)) * 1.96).toFixed(2)
                : "…"}{" "}
              {tokenSymbol}
            </span>
          </div>

          {/* Created */}
          {createdAt && (
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-zinc-400">Created</span>
              <span className="text-xs text-zinc-300">{formatDate(createdAt)} <span className="text-zinc-500">({timeAgo(createdAt)})</span></span>
            </div>
          )}
        </div>
      </section>

      {/* Head-to-head */}
      {!isPlayerA && h2h && h2h.myWins + h2h.theirWins + h2h.ties > 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 py-2.5 text-xs">
          <span className="text-zinc-500">vs this host</span>
          <span className="ml-auto text-green-400">{h2h.myWins}W</span>
          <span className="text-zinc-700">·</span>
          <span className="text-red-400">{h2h.theirWins}L</span>
          {h2h.ties > 0 && (
            <>
              <span className="text-zinc-700">·</span>
              <span className="text-yellow-400">{h2h.ties}T</span>
            </>
          )}
        </div>
      )}

      {/* Player A — waiting for opponent */}
      {room.state === ROOM_STATE.OPEN && isPlayerA && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 flex flex-col gap-3">
          <p className="text-sm text-zinc-300">You created this room. Share the link to challenge your opponent.</p>
          <SoftBlurText
            text="Waiting for someone to join…"
            className="text-sm text-center text-yellow-600 block"
            loop
          />
          {cancelSuccess ? (
            <SoftBlurText
              text="Redirecting to home…"
              className="text-xs text-center text-zinc-500 block"
            />
          ) : (
            <>
              <button
                type="button"
                onClick={() => navigator.clipboard?.writeText(window.location.href)}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-800/50 py-2.5 text-xs font-medium text-zinc-300 active:opacity-70 transition-opacity"
              >
                Copy invite link
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={onCancel}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/40 bg-red-500/5 py-2.5 text-xs font-medium text-red-400 active:opacity-70 disabled:opacity-40 transition-opacity"
              >
                {busy
                  ? <><Spinner /> Cancelling…</>
                  : <><CircleSlash className="h-3.5 w-3.5" /> Cancel room — recover stake</>}
              </button>
            </>
          )}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">
          {error}
        </div>
      )}

      {/* Player B — can join */}
      {room.state === ROOM_STATE.OPEN && !isPlayerA && (
        <>
          {/* Balance / allowance status row */}
          {hasInsufficientBalance ? (
            <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/8 px-3 py-2.5 text-xs text-red-400">
              <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-red-400" />
              Insufficient balance — you have {balanceFormatted} {tokenSymbol}
            </div>
          ) : (
            <div className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-xs ${
              allowanceReady
                ? "border-green-500/20 bg-green-500/5 text-green-400"
                : "border-zinc-800 bg-zinc-900/60 text-zinc-500"
            }`}>
              <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${allowanceReady ? "bg-green-400" : "bg-zinc-600"}`} />
              {allowanceReady ? "Ready — 1 transaction to confirm" : "Needs approval + join — 2 transactions"}
            </div>
          )}

          <button
            type="button"
            disabled={!isConnected || busy || hasInsufficientBalance}
            onClick={onJoin}
            className={`flex items-center justify-center gap-2 rounded-2xl py-4 text-center font-semibold transition-colors active:opacity-80 disabled:opacity-40 ${
              hasInsufficientBalance
                ? "bg-red-500/20 border border-red-500/40 text-red-400 cursor-not-allowed"
                : "bg-celo-yellow text-celo-dark"
            }`}
          >
            {busy
              ? <><Spinner /> Joining…</>
              : hasInsufficientBalance
                ? `Insufficient ${tokenSymbol} — top up to continue`
                : `Match ${tokenDecimals != null ? formatUnits(room.stake, tokenDecimals) : "…"} ${tokenSymbol}`}
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

      <FloatingToast show={cancelSuccess} message="Room cancelled — stake recovered" />

      {/* Resolved / expired */}
      {(room.state === ROOM_STATE.RESOLVED || room.state === ROOM_STATE.EXPIRED) && (
        <div className="flex flex-col gap-3">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 text-center">
            <p className="text-sm text-zinc-400">
              {room.state === ROOM_STATE.RESOLVED
                ? "This game has already been resolved."
                : "This game expired — host never revealed."}
            </p>
            {(isPlayerA || isPlayerB) && (
              <Link
                href={`/game/${params.roomId}`}
                className="mt-2 inline-block text-xs text-celo-yellow underline"
              >
                View result →
              </Link>
            )}
          </div>
          <Link
            href="/create"
            className="rounded-2xl border border-zinc-700 py-4 text-center font-semibold text-zinc-300 active:opacity-80"
          >
            Create a new room
          </Link>
        </div>
      )}
    </div>
  );
}
