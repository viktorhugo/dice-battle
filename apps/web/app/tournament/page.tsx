"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { parseUnits, decodeEventLog, type Address } from "viem";
import { useConnection, usePublicClient, useReadContract, useWriteContract } from "wagmi";
import { WalletBar } from "@/components/WalletBar";
import { Identicon } from "@/components/ui/identicon";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
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
import { useErrorToast } from "@/hooks/useErrorToast";
import { truncateAddress } from "@/lib/utils";
import { logger } from "@/lib/logger";

// ─── ABI ──────────────────────────────────────────────────────────────────────

const DAILY_TOURNAMENT_ABI = [
  {
    name: "dayInfo",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "dayId", type: "uint256" }],
    outputs: [
      { name: "pool", type: "uint128" },
      { name: "finalized", type: "bool" },
      { name: "top", type: "address[3]" },
      { name: "wins", type: "uint32[3]" },
      { name: "prizes", type: "uint256[3]" },
      { name: "claimed", type: "bool[3]" },
    ],
  },
] as const;

// ─── Constants ────────────────────────────────────────────────────────────────

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as Address;
const hasTournament = TOURNAMENT_ADDRESS !== ZERO_ADDRESS;
const MEDAL = ["🥇", "🥈", "🥉"];
const RANK_COLORS = [
  "border-yellow-500/30 bg-yellow-500/5",
  "border-white/20 bg-white/5",
  "border-orange-500/20 bg-orange-500/5",
];

function rankStyle(i: number) {
  return RANK_COLORS[i] ?? "border-white/10 bg-white/5";
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function currentDayId() {
  return BigInt(Math.floor(Date.now() / 1000 / 86_400));
}

function formatCountdown(ms: number) {
  if (ms <= 0) return "0h 00m 00s";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1_000);
  return `${h}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function RowSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
      <Skeleton className="h-4 w-5" />
      <Skeleton className="h-7 w-7 rounded-full" />
      <Skeleton className="h-3 w-24" />
      <div className="ml-auto">
        <Skeleton className="h-3 w-8" />
      </div>
    </div>
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
  const [pendingRoom, setPendingRoom] = useState<{
    roomId: string;
    secret: `0x${string}`;
  } | null>(null);
  const [error, setError] = useErrorToast();

  const dayId = currentDayId();
  const USDT = getTokenAddress("USDT");

  const { data: todayInfo } = useReadContract({
    address: TOURNAMENT_ADDRESS,
    abi: DAILY_TOURNAMENT_ABI,
    functionName: "dayInfo",
    args: [dayId],
    query: { enabled: hasTournament, refetchInterval: 30_000 },
  });

  const { data: yesterdayInfo } = useReadContract({
    address: TOURNAMENT_ADDRESS,
    abi: DAILY_TOURNAMENT_ABI,
    functionName: "dayInfo",
    args: [dayId - 1n],
    query: { enabled: hasTournament },
  });

  useEffect(() => {
    const since = Math.floor(Date.now() / 1000 / 86_400) * 86_400;
    getLeaderboardPeriod(since)
      .then((data) => setLeaderboard(data.sort((a, b) => b.wins - a.wins).slice(0, 10)))
      .catch((e: unknown) => logger.error("[tournament] leaderboard:", e))
      .finally(() => setLbLoading(false));
  }, []);

  useEffect(() => {
    function tick() {
      const nextMidnight = (Math.floor(Date.now() / 86_400_000) + 1) * 86_400_000;
      setCountdown(formatCountdown(nextMidnight - Date.now()));
    }
    tick();
    const id = setInterval(tick, 1_000);
    return () => clearInterval(id);
  }, []);

  async function onQuickPlay() {
    if (!address || !publicClient) {
      setError("Connect your wallet first");
      return;
    }
    if (GAME_ADDRESS === ZERO_ADDRESS) {
      setError("Contract not configured");
      return;
    }

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
        const h = await writeContractAsync({
          address: USDT,
          abi: ERC20_ABI,
          functionName: "approve",
          args: [GAME_ADDRESS, stakeWei],
        });
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
          const decoded = decodeEventLog({
            abi: DICE_BATTLE_ABI,
            data: log.data,
            topics: log.topics,
          });
          if (decoded.eventName === "RoomCreated") {
            roomId = (decoded.args as { roomId: bigint }).roomId;
            break;
          }
        } catch {
          // log from another contract
        }
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

  const pool = todayInfo ? Number(todayInfo.pool) / 1e6 : null;
  const yesterday = yesterdayInfo?.finalized ? yesterdayInfo : null;

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
        <Link href="/" className="text-sm text-white/60">
          ← Back
        </Link>
        <h1 className="text-lg font-semibold">🏆 Daily</h1>
        <div className="w-10" />
      </header>

      {/* Pool + countdown */}
      {hasTournament ? (
        <div className="flex items-center justify-between rounded-2xl border border-yellow-500/20 bg-yellow-500/5 px-5 py-4">
          <div>
            <p className="text-xs text-white/50">Prize pool</p>
            {pool !== null ? (
              <p className="text-2xl font-bold text-white">{pool.toFixed(2)} USDT</p>
            ) : (
              <Skeleton className="mt-1 h-7 w-28" />
            )}
          </div>
          <div className="text-right">
            <p className="text-xs text-white/50">Ends in</p>
            <p className="font-mono text-sm text-celo-yellow">{countdown}</p>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center text-sm text-white/40">
          Tournament contract not deployed yet
        </div>
      )}

      {/* Today's leaderboard */}
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-white/60">Today&apos;s leaderboard</h2>

        {lbLoading ? (
          <ul className="flex flex-col gap-2">
            {[0, 1, 2].map((i) => (
              <RowSkeleton key={i} />
            ))}
          </ul>
        ) : leaderboard.length === 0 ? (
          <p className="py-4 text-center text-sm text-white/30">No games today yet</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {leaderboard.map((entry, i) => (
              <li key={entry.address}>
                <Link
                  href={`/profile/${entry.address}`}
                  className={`flex items-center gap-3 rounded-xl border px-4 py-3 active:opacity-70 ${rankStyle(i)}`}
                >
                  <span className="w-5 text-center text-sm">
                    {i < 3 ? MEDAL[i] : <span className="text-white/30">{i + 1}</span>}
                  </span>
                  <Identicon address={entry.address} size={28} />
                  <span className="flex-1 font-mono text-xs text-white">
                    {truncateAddress(entry.address)}
                  </span>
                  <span className="text-sm font-semibold text-white">{entry.wins} wins</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Quick play CTA */}
      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">
          {error}
        </div>
      )}

      <button
        type="button"
        disabled={!isConnected || busy}
        onClick={onQuickPlay}
        className="flex items-center justify-center gap-2 rounded-2xl bg-celo-yellow py-4 font-semibold text-celo-dark active:opacity-80 disabled:opacity-40"
      >
        {step === "approving" && (
          <>
            <Spinner /> Approving…
          </>
        )}
        {step === "creating" && (
          <>
            <Spinner /> Creating room…
          </>
        )}
        {step === "idle" && (!isConnected ? "Connect wallet" : "Quick play tournament →")}
      </button>

      {/* Yesterday's winners */}
      {yesterday && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-white/60">Yesterday&apos;s winners</h2>
          <ul className="flex flex-col gap-2">
            {(yesterday.top as readonly Address[]).map((addr, i) =>
              addr !== ZERO_ADDRESS ? (
                <li key={addr}>
                  <Link
                    href={`/profile/${addr}`}
                    className={`flex items-center gap-3 rounded-xl border px-4 py-3 active:opacity-70 ${rankStyle(i)}`}
                  >
                    <span className="w-5 text-center text-sm">{MEDAL[i]}</span>
                    <Identicon address={addr} size={28} />
                    <span className="flex-1 font-mono text-xs text-white">
                      {truncateAddress(addr)}
                    </span>
                    <span className="font-mono text-sm font-semibold text-green-400">
                      won{" "}
                      {(
                        Number((yesterday.prizes as readonly bigint[])[i]) / 1e6
                      ).toFixed(2)}{" "}
                      USDT
                    </span>
                  </Link>
                </li>
              ) : null
            )}
          </ul>
        </section>
      )}
    </div>
  );
}
