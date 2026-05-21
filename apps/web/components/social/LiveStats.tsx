"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useConnection } from "wagmi";
import { Skeleton } from "@/components/ui/skeleton";
import { getLiveStats, type LiveStats } from "@/lib/indexer";
import { logger } from "@/lib/logger";

const FAST_POLL_MS = 2_000;
const FAST_POLL_DURATION_MS = 10_000;
const NORMAL_POLL_MS = 30_000;

function StatItem({
  value,
  label,
  href,
  className = "",
}: {
  value: string | number;
  label: string;
  href?: string;
  className?: string;
}) {
  const content = (
    <>
      <span className="text-sm font-bold tabular-nums text-white">{value}</span>
      <span className="text-[10px] text-white/40">{label}</span>
    </>
  );

  if (href) {
    return (
      <Link href={href} className={`flex flex-col items-center gap-0.5 active:opacity-70 ${className}`}>
        {content}
      </Link>
    );
  }

  return (
    <div className={`flex flex-col items-center gap-0.5 ${className}`}>
      {content}
    </div>
  );
}

export function LiveStats() {
  const [stats, setStats] = useState<LiveStats | null>(null);
  const [fastPoll, setFastPoll] = useState(false);
  const [optimisticOffset, setOptimisticOffset] = useState(0);
  const searchParams = useSearchParams();
  const router = useRouter();
  const { address } = useConnection();

  const cancelled = searchParams.get("cancelled") === "1";

  // B: optimistic offset + C: fast-poll mode when coming from a cancel
  useEffect(() => {
    if (!cancelled) return;
    setFastPoll(true);
    setOptimisticOffset(-1);
    const timer = setTimeout(() => {
      setFastPoll(false);
      setOptimisticOffset(0);
      router.replace("/");
    }, FAST_POLL_DURATION_MS);
    return () => clearTimeout(timer);
  }, [cancelled, router]);

  useEffect(() => {
    async function refresh() {
      try {
        const data = await getLiveStats(address ?? undefined);
        logger.log("[liveStats]", data);
        setStats(data);
      } catch (e) {
        logger.error("[liveStats] Error:", e);
      }
    }

    refresh();
    const id = setInterval(refresh, fastPoll ? FAST_POLL_MS : NORMAL_POLL_MS);
    return () => clearInterval(id);
  }, [fastPoll, address]);

  if (!stats) {
    return (
      <div className="grid grid-cols-3 gap-2 rounded-xl border border-white/10 bg-white/5 p-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex flex-col items-center gap-1.5">
            <Skeleton className="h-4 w-8" />
            <Skeleton className="h-2.5 w-16" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 rounded-xl border border-white/10 bg-white/5">
      <StatItem
        value={Math.max(0, stats.openRooms + optimisticOffset)}
        label="Open rooms"
        href="/rooms"
        className="border-r border-white/10 py-3"
      />
      <StatItem
        value={stats.gamesToday}
        label="Games today"
        href="/leaderboard"
        className="border-r border-white/10 py-3"
      />
      <StatItem value={stats.totalGames} label="All-time" href="/leaderboard" className="py-3" />
    </div>
  );
}
