"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { parseUnits, decodeEventLog, type Address } from "viem";
import { useConnection, usePublicClient, useReadContract, useWriteContract } from "wagmi";
import { Trophy, Crown, Flame, Clock, Coins, ChevronRight, CalendarDays } from "lucide-react";
import { WalletBar } from "@/components/WalletBar";
import { Identicon } from "@/components/ui/identicon";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { LightRays } from "@/components/ui/light-rays";
import { SecretBackupModal, hasSeenBackup } from "@/components/game/SecretBackupModal";
import { DICE_BATTLE_ABI } from "@/lib/abi";
import { computeCommitment, generateSecret, storeSecret } from "@/lib/commitment";
import {
  ERC20_ABI,
  GAME_ADDRESS,
  TOURNAMENT_ADDRESS,
  getTokenAddress,
} from "@/lib/constants";
import { getLeaderboardPeriod, type LeaderboardEntry } from "@/lib/indexer";
import { useDisplayName } from "@/hooks/useDisplayName";
import { useErrorToast } from "@/hooks/useErrorToast";
import { logger } from "@/lib/logger";

// ─── ABI ──────────────────────────────────────────────────────────────────────

const DAILY_TOURNAMENT_ABI = [
  {
    name: "dayInfo",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "dayId", type: "uint256" }],
    outputs: [
      { name: "pool",      type: "uint128"    },
      { name: "finalized", type: "bool"       },
      { name: "top",       type: "address[3]" },
      { name: "wins",      type: "uint32[3]"  },
      { name: "prizes",    type: "uint256[3]" },
      { name: "claimed",   type: "bool[3]"    },
    ],
  },
] as const;

// ─── Constants ────────────────────────────────────────────────────────────────

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as Address;
const hasTournament = TOURNAMENT_ADDRESS !== ZERO_ADDRESS;

// Returns the dayId for the upcoming Saturday (the one being competed for).
// dayId = unix timestamp / 86400
function upcomingSaturdayDayId(): bigint {
  const now = new Date();
  const dayOfWeek = now.getUTCDay(); // 0=Sun … 6=Sat
  const daysToSat = (6 - dayOfWeek + 7) % 7; // 0 if today is Saturday
  const todayId = Math.floor(Date.now() / 1000 / 86_400);
  return BigInt(todayId + daysToSat);
}

// Returns the dayId for the last finalized Saturday (previous week).
function lastSaturdayDayId(): bigint {
  const dayOfWeek = new Date().getUTCDay();
  const daysBack = dayOfWeek === 6 ? 7 : dayOfWeek + 1;
  const todayId = Math.floor(Date.now() / 1000 / 86_400);
  return BigInt(todayId - daysBack);
}

// Returns Unix seconds for the start of the current week (last Sunday 00:00 UTC).
function thisWeekStartSeconds(): number {
  const now = new Date();
  const dayOfWeek = now.getUTCDay();
  const lastSunday = new Date(now);
  lastSunday.setUTCDate(lastSunday.getUTCDate() - dayOfWeek);
  lastSunday.setUTCHours(0, 0, 0, 0);
  return Math.floor(lastSunday.getTime() / 1000);
}

// Milliseconds until next Sunday 00:00 UTC (= Saturday night tournament end).
function msUntilSundayMidnight(): number {
  const now = new Date();
  const dayOfWeek = now.getUTCDay();
  const daysUntilSunday = dayOfWeek === 0 ? 7 : 7 - dayOfWeek;
  const next = new Date(now);
  next.setUTCDate(next.getUTCDate() + daysUntilSunday);
  next.setUTCHours(0, 0, 0, 0);
  return next.getTime() - now.getTime();
}

function formatCountdown(ms: number) {
  if (ms <= 0) return "0d 00h 00m";
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1_000);
  if (d > 0) return `${d}d ${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m`;
  return `${h}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
}

function rowHighlight(rank: number) {
  if (rank === 0) return "border-yellow-500/30 bg-yellow-500/5";
  if (rank === 1) return "border-white/20 bg-white/5";
  if (rank === 2) return "border-orange-500/20 bg-orange-500/5";
  return "border-white/10 bg-white/5";
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function RankBadge({ rank }: { rank: number }) {
  if (rank === 0) return <Crown className="h-4 w-4 text-yellow-400" />;
  if (rank === 1) return <span className="text-sm font-bold text-white/50">2</span>;
  if (rank === 2) return <span className="text-sm font-bold text-orange-400">3</span>;
  return <span className="text-sm text-white/25">{rank + 1}</span>;
}

function RowSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
      <Skeleton className="h-4 w-5" />
      <Skeleton className="h-7 w-7 rounded-full" />
      <Skeleton className="h-3 w-28" />
      <div className="ml-auto"><Skeleton className="h-3 w-8" /></div>
    </div>
  );
}

function TournamentRow({ entry, rank }: { entry: LeaderboardEntry; rank: number }) {
  const displayName = useDisplayName(entry.address);
  return (
    <li>
      <Link
        href={`/profile/${entry.address}`}
        className={`flex items-center gap-3 rounded-xl border px-4 py-3 active:opacity-70 transition-opacity ${rowHighlight(rank)}`}
      >
        <span className="flex w-5 items-center justify-center"><RankBadge rank={rank} /></span>
        <Identicon address={entry.address} size={28} />
        <span className="flex-1 truncate text-xs text-white">{displayName}</span>
        <div className="text-right">
          <p className="text-sm font-semibold text-white tabular-nums">
            {entry.totalGames >= 5
              ? (entry.wins * (entry.winRate / 100)).toFixed(1)
              : "—"}
          </p>
          <p className="text-[10px] text-white/35 tabular-nums">{entry.wins}W · {entry.winRate}%</p>
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-white/20" />
      </Link>
    </li>
  );
}

function WinnerRow({ address, rank, prize }: { address: Address; rank: number; prize: bigint }) {
  const displayName = useDisplayName(address);
  return (
    <li>
      <Link
        href={`/profile/${address}`}
        className={`flex items-center gap-3 rounded-xl border px-4 py-3 active:opacity-70 transition-opacity ${rowHighlight(rank)}`}
      >
        <span className="flex w-5 items-center justify-center"><RankBadge rank={rank} /></span>
        <Identicon address={address} size={28} />
        <span className="flex-1 truncate text-xs text-white">{displayName}</span>
        <span className="font-mono text-sm font-semibold text-green-400">
          +{(Number(prize) / 1e6).toFixed(2)} USDT
        </span>
        <ChevronRight className="h-3.5 w-3.5 text-white/20" />
      </Link>
    </li>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TournamentPage() {
  const router = useRouter();
  const { address, isConnected } = useConnection();
  const publicClient = usePublicClient();
  const { mutateAsync: writeContractAsync } = useWriteContract();

  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [lbLoading, setLbLoading] = useState(true);
  const [countdown, setCountdown] = useState("");
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<"idle" | "approving" | "creating">("idle");
  const [pendingRoom, setPendingRoom] = useState<{ roomId: string; secret: `0x${string}` } | null>(null);
  const [error, setError] = useErrorToast();

  const saturdayId = upcomingSaturdayDayId();
  const prevSaturdayId = lastSaturdayDayId();
  const USDT = getTokenAddress("USDT");

  // Prize pool for the upcoming Saturday
  const { data: weekInfo } = useReadContract({
    address: TOURNAMENT_ADDRESS,
    abi: DAILY_TOURNAMENT_ABI,
    functionName: "dayInfo",
    args: [saturdayId],
    query: { enabled: hasTournament, refetchInterval: 30_000 },
  });

  // Last week's finalized winners
  const { data: lastWeekInfo } = useReadContract({
    address: TOURNAMENT_ADDRESS,
    abi: DAILY_TOURNAMENT_ABI,
    functionName: "dayInfo",
    args: [prevSaturdayId],
    query: { enabled: hasTournament },
  });

  // This week's leaderboard (Sun–Sat)
  useEffect(() => {
    getLeaderboardPeriod(thisWeekStartSeconds())
      .then((data) => {
        const MIN_GAMES = 5;
        const score = (e: typeof data[0]) =>
          e.totalGames >= MIN_GAMES ? e.wins * (e.winRate / 100) : 0;
        setLeaderboard(
          [...data].sort((a, b) => score(b) - score(a) || b.wins - a.wins).slice(0, 10)
        );
      })
      .catch((e: unknown) => logger.error("[tournament] leaderboard:", e))
      .finally(() => setLbLoading(false));
  }, []);

  // Countdown to Saturday night (Sunday 00:00 UTC)
  useEffect(() => {
    function tick() { setCountdown(formatCountdown(msUntilSundayMidnight())); }
    tick();
    const id = setInterval(tick, 1_000);
    return () => clearInterval(id);
  }, []);

  async function onQuickPlay() {
    if (!address || !publicClient) { setError("Connect your wallet first"); return; }
    if (GAME_ADDRESS === ZERO_ADDRESS) { setError("Contract not configured"); return; }

    setBusy(true);
    try {
      const stakeWei = parseUnits("1", 6);
      const allowance = (await publicClient.readContract({
        address: USDT,
        abi: ERC20_ABI,
        functionName: "allowance",
        args: [address, GAME_ADDRESS],
      })) as bigint;

      if (allowance < stakeWei) {
        setStep("approving");
        const h = await writeContractAsync({ address: USDT, abi: ERC20_ABI, functionName: "approve", args: [GAME_ADDRESS, stakeWei] });
        await publicClient.waitForTransactionReceipt({ hash: h });
        await new Promise((r) => setTimeout(r, 2_000));
      }

      const secret = generateSecret();
      const commitment = computeCommitment(secret, address);

      setStep("creating");
      const createHash = await writeContractAsync({
        address: GAME_ADDRESS,
        abi: DICE_BATTLE_ABI,
        functionName: "createRoom",
        args: [USDT, stakeWei, commitment],
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash: createHash });
      if (receipt.status === "reverted") throw new Error("Transaction reverted");

      let roomId: bigint | null = null;
      for (const log of receipt.logs) {
        try {
          const decoded = decodeEventLog({ abi: DICE_BATTLE_ABI, data: log.data, topics: log.topics });
          if (decoded.eventName === "RoomCreated") {
            roomId = (decoded.args as { roomId: bigint }).roomId;
            break;
          }
        } catch { /* log from another contract */ }
      }
      if (!roomId) throw new Error("Could not find RoomCreated event");

      storeSecret(roomId.toString(), secret);
      if (hasSeenBackup(roomId.toString())) {
        router.push(`/join/${roomId}`);
      } else {
        setPendingRoom({ roomId: roomId.toString(), secret });
      }
    } catch (e) {
      logger.error("[tournament] quickPlay:", e);
      setError(e);
      setStep("idle");
    } finally {
      setBusy(false);
    }
  }

  const pool = weekInfo ? Number(weekInfo[0]) / 1e6 : null;
  const lastWeekFinalized = lastWeekInfo?.[1] ?? false;

  return (
    <div className="flex flex-col gap-6">
      <WalletBar />

      {pendingRoom && (
        <SecretBackupModal
          roomId={pendingRoom.roomId}
          secret={pendingRoom.secret}
          onDismiss={() => router.push(`/join/${pendingRoom.roomId}`)}
        />
      )}

      {/* Header */}
      <header className="flex items-center justify-between pt-2">
        <Link href="/" className="text-sm text-white/60">← Back</Link>
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-[#FCFF52]" />
          <h1 className="text-lg font-semibold">Weekly Tournament</h1>
        </div>
        <div className="w-10" />
      </header>

      {/* Pool + countdown */}
      {hasTournament ? (
        <div className="relative overflow-hidden rounded-2xl border border-yellow-500/20 bg-yellow-500/5 px-5 py-5">
          <LightRays count={4} color="rgba(252, 255, 82, 0.15)" blur={44} speed={18} length="100%" />
          <div className="relative flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <Coins className="h-3.5 w-3.5 text-yellow-400/70" />
                <p className="text-xs text-white/50">Prize pool</p>
              </div>
              {pool !== null ? (
                <p className="text-3xl font-bold text-white tabular-nums">
                  {pool.toFixed(2)}{" "}
                  <span className="text-lg font-semibold text-white/60">USDT</span>
                </p>
              ) : (
                <Skeleton className="mt-1 h-8 w-32" />
              )}
            </div>
            <div className="text-right">
              <div className="flex items-center justify-end gap-1.5 mb-1">
                <Clock className="h-3.5 w-3.5 text-white/40" />
                <p className="text-xs text-white/50">Ends Saturday</p>
              </div>
              <p className="font-mono text-sm font-semibold text-[#FCFF52]">{countdown}</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-center">
          <Trophy className="mx-auto mb-2 h-8 w-8 text-white/20" />
          <p className="text-sm text-white/40">Tournament contract not deployed yet</p>
        </div>
      )}

      {/* This week's leaderboard */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Flame className="h-4 w-4 text-orange-400" />
          <h2 className="text-sm font-semibold text-white/70">This week&apos;s standings</h2>
        </div>

        {lbLoading ? (
          <ul className="flex flex-col gap-2">
            {[0, 1, 2, 3].map((i) => <RowSkeleton key={i} />)}
          </ul>
        ) : leaderboard.length === 0 ? (
          <p className="py-6 text-center text-sm text-white/30">No games played this week yet</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {leaderboard.map((entry, i) => (
              <TournamentRow key={entry.address} entry={entry} rank={i} />
            ))}
          </ul>
        )}
      </section>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">
          {error}
        </div>
      )}

      {/* Quick play CTA */}
      <button
        type="button"
        disabled={!isConnected || busy}
        onClick={onQuickPlay}
        className="flex items-center justify-center gap-2 rounded-2xl bg-celo-yellow py-4 font-semibold text-celo-dark active:opacity-80 disabled:opacity-40 transition-opacity"
      >
        {step === "approving" && <><Spinner /> Approving…</>}
        {step === "creating"  && <><Spinner /> Creating room…</>}
        {step === "idle" && (
          !isConnected ? "Connect wallet" : <>Play for the prize <Trophy className="h-4 w-4" /></>
        )}
      </button>

      {/* Last week's winners */}
      {lastWeekFinalized && lastWeekInfo && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-yellow-400/70" />
            <h2 className="text-sm font-semibold text-white/70">Last week&apos;s winners</h2>
          </div>
          <ul className="flex flex-col gap-2">
            {(lastWeekInfo[2] as readonly Address[]).map((addr, i) =>
              addr !== ZERO_ADDRESS ? (
                <WinnerRow
                  key={addr}
                  address={addr}
                  rank={i}
                  prize={(lastWeekInfo[4] as readonly bigint[])[i]}
                />
              ) : null
            )}
          </ul>
        </section>
      )}
    </div>
  );
}
