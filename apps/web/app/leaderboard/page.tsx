"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { WalletBar } from "@/components/WalletBar";
import { Identicon } from "@/components/ui/identicon";
import { Skeleton } from "@/components/ui/skeleton";
import { useDisplayName } from "@/hooks/useDisplayName";
import {
  getLeaderboardAllTime,
  getLeaderboardPeriod,
  type LeaderboardEntry,
  type LeaderboardTab,
  type SortKey,
} from "@/lib/indexer";
import { logger } from "@/lib/logger";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TABS: { key: LeaderboardTab; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "week", label: "Week" },
  { key: "alltime", label: "All-time" },
];

const SORTS: { key: SortKey; label: string }[] = [
  { key: "wins", label: "Wins" },
  { key: "winRate", label: "Win Rate" },
  { key: "volume", label: "Volume" },
];

const MEDAL: Record<number, string> = { 0: "🥇", 1: "🥈", 2: "🥉" };

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

function sortEntries(entries: LeaderboardEntry[], key: SortKey): LeaderboardEntry[] {
  return [...entries].sort((a, b) => {
    if (key === "winRate") {
      const diff = b.winRate - a.winRate;
      return diff !== 0 ? diff : b.wins - a.wins; // tiebreak by wins
    }
    if (key === "volume") {
      return b.volume > a.volume ? 1 : b.volume < a.volume ? -1 : 0;
    }
    return b.wins - a.wins;
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function RowSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
      <Skeleton className="h-4 w-5" />
      <Skeleton className="h-7 w-7 rounded-full" />
      <Skeleton className="h-3 w-24" />
      <div className="ml-auto flex gap-3">
        <Skeleton className="h-3 w-8" />
        <Skeleton className="h-3 w-10" />
      </div>
    </div>
  );
}

function LeaderboardRow({
  entry,
  rank,
  sort,
}: {
  entry: LeaderboardEntry;
  rank: number;
  sort: SortKey;
}) {
  const displayName = useDisplayName(entry.address);
  const medal = MEDAL[rank];
  const highlight =
    rank === 0
      ? "border-yellow-500/30 bg-yellow-500/5"
      : rank === 1
      ? "border-white/20 bg-white/5"
      : rank === 2
      ? "border-orange-500/20 bg-orange-500/5"
      : "border-white/10 bg-white/5";

  return (
    <li>
      <Link
        href={`/profile/${entry.address}`}
        className={`flex items-center gap-3 rounded-xl border px-4 py-3 active:opacity-70 ${highlight}`}
      >
        <span className="w-5 text-center text-sm">
          {medal ?? <span className="text-white/30">{rank + 1}</span>}
        </span>

        <Identicon address={entry.address} size={28} />

        <span className="flex-1 font-mono text-xs text-white">
          {displayName}
        </span>

        <span className="text-sm font-semibold text-white">
          {sort === "volume"
            ? `${entry.totalGames}g`
            : sort === "winRate"
            ? `${entry.winRate}%`
            : `${entry.wins}W`}
        </span>

        <span className="w-10 text-right text-xs text-white/40">
          {sort === "volume"
            ? `${entry.wins}W`
            : sort === "winRate"
            ? `${entry.wins}W`
            : `${entry.winRate}%`}
        </span>
      </Link>
    </li>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LeaderboardPage() {
  const searchParams = useSearchParams();
  const initialTab = (["today", "week", "alltime"].includes(searchParams.get("period") ?? "")
    ? searchParams.get("period")
    : "alltime") as LeaderboardTab;
  const [tab, setTab] = useState<LeaderboardTab>(initialTab);
  const [sort, setSort] = useState<SortKey>("wins");
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    const fetch =
      tab === "alltime"
        ? getLeaderboardAllTime(50)
        : getLeaderboardPeriod(
            nowSeconds() - (tab === "today" ? 86_400 : 604_800)
          );

    fetch
      .then((data) => {
        logger.log("[leaderboard] tab:", tab, "entries:", data.length);
        setEntries(data);
      })
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : String(e);
        logger.error("[leaderboard] Error:", msg);
        setError(msg);
      })
      .finally(() => setLoading(false));
  }, [tab]);

  const sorted = useMemo(() => sortEntries(entries, sort), [entries, sort]);

  return (
    <div className="flex flex-col gap-6">
      <WalletBar />

      <header className="flex items-center justify-between pt-2">
        <Link href="/" className="text-sm text-white/60">← Back</Link>
        <h1 className="text-lg font-semibold">Leaderboard</h1>
        <div className="w-10" />
      </header>

      {/* Tabs */}
      <div className="flex rounded-xl bg-white/5 p-1">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 rounded-lg py-1.5 text-sm font-medium transition-colors ${
              tab === key
                ? "bg-celo-yellow text-celo-dark"
                : "text-white/50 hover:text-white/80"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Sort selector */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-white/40">Sort:</span>
        <div className="flex gap-1">
          {SORTS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setSort(key)}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                sort === key
                  ? "bg-white/15 text-white"
                  : "text-white/40 hover:text-white/70"
              }`}
            >
              {label} {sort === key && "▼"}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {loading ? (
        <ul className="flex flex-col gap-2">
          {[0, 1, 2, 3, 4].map((i) => <RowSkeleton key={i} />)}
        </ul>
      ) : error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">
          {error}
        </div>
      ) : sorted.length === 0 ? (
        <p className="pt-10 text-center text-sm text-white/40">
          No games in this period yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {sorted.map((entry, i) => (
            <LeaderboardRow key={entry.address} entry={entry} rank={i} sort={sort} />
          ))}
        </ul>
      )}
    </div>
  );
}
