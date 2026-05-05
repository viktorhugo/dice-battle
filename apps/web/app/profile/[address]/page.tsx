"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { formatUnits } from "viem";
import { WalletBar } from "@/components/WalletBar";
import { Identicon } from "@/components/ui/identicon";
import { Skeleton } from "@/components/ui/skeleton";
import { getTokenDecimals } from "@/lib/constants";
import { truncateAddress, getTokenSymbol } from "@/lib/utils";
import { getPlayerProfile, type IndexerPlayer, type IndexerProfileRoom } from "@/lib/indexer";
import { logger } from "@/lib/logger";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeDiceStats(rooms: IndexerProfileRoom[], address: string) {
  const addrLower = address.toLowerCase();
  const rolls: number[] = [];
  let bestTotal = -1;
  let bestHand = { d1: 0, d2: 0 };

  for (const room of rooms) {
    if (room.rollA1 == null || room.rollB1 == null) continue;
    const isA = room.playerA === addrLower;
    const d1 = isA ? room.rollA1 : room.rollB1;
    const d2 = isA ? (room.rollA2 ?? 0) : (room.rollB2 ?? 0);
    rolls.push(d1, d2);
    if (d1 + d2 > bestTotal) { bestTotal = d1 + d2; bestHand = { d1, d2 }; }
  }

  if (rolls.length === 0) return null;

  const avg = (rolls.reduce((a, b) => a + b, 0) / rolls.length).toFixed(1);
  const freq: Record<number, number> = {};
  for (const r of rolls) freq[r] = (freq[r] ?? 0) + 1;
  const lucky = Number(Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0]);

  return { avg, bestHand, lucky };
}

function computeAvgDuration(rooms: IndexerProfileRoom[]): string | null {
  const durations = rooms
    .filter((r) => r.resolvedAt && r.createdAt)
    .map((r) => Number(r.resolvedAt) - Number(r.createdAt));

  if (durations.length === 0) return null;

  const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
  const m = Math.floor(avg / 60);
  const s = Math.round(avg % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl bg-white/5 py-3">
      <span className="text-base font-bold text-white">{value}</span>
      <span className="text-xs text-white/40">{label}</span>
    </div>
  );
}

function OutcomeBar({ wins, losses, ties }: { wins: number; losses: number; ties: number }) {
  const total = wins + losses + ties;
  if (total === 0) return null;
  const wPct = (wins / total) * 100;
  const lPct = (losses / total) * 100;
  const tPct = (ties / total) * 100;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-white/10">
        {wPct > 0 && <div className="bg-green-500 transition-all" style={{ width: `${wPct}%` }} />}
        {lPct > 0 && <div className="bg-red-500 transition-all" style={{ width: `${lPct}%` }} />}
        {tPct > 0 && <div className="bg-yellow-500 transition-all" style={{ width: `${tPct}%` }} />}
      </div>
      <div className="flex justify-between px-0.5 text-xs">
        <span className="text-green-400">{wins}W</span>
        <span className="text-white/30">{total} games</span>
        <span className="text-red-400">{losses}L · <span className="text-yellow-400">{ties}T</span></span>
      </div>
    </div>
  );
}

function GameRow({ room, address }: { room: IndexerProfileRoom; address: string }) {
  const addrLower = address.toLowerCase();
  const opponent = room.playerA === addrLower ? room.playerB : room.playerA;

  const isWin = room.state === "RESOLVED" && room.winner === addrLower;
  const isTie = room.state === "TIED";
  const isLoss = room.state === "RESOLVED" && !isWin;

  const resultLabel = isTie ? "Tied" : isWin ? "Won" : isLoss ? "Lost" : "Expired";
  const resultColor = isTie
    ? "text-yellow-400"
    : isWin
    ? "text-green-400"
    : isLoss
    ? "text-red-400"
    : "text-white/30";

  const amount = formatUnits(
    BigInt(room.stake),
    getTokenDecimals(room.token as `0x${string}`)
  );
  const symbol = getTokenSymbol(room.token);

  return (
    <li>
      <Link
        href={`/game/${room.id}`}
        className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3 active:opacity-70"
      >
        <span className={`w-14 text-sm font-semibold ${resultColor}`}>{resultLabel}</span>
        <span className="text-sm text-white">{amount} {symbol}</span>
        <span className="font-mono text-xs text-white/40">
          {opponent ? truncateAddress(opponent) : "—"}
        </span>
      </Link>
    </li>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const { address } = useParams<{ address: string }>();
  const [player, setPlayer] = useState<IndexerPlayer | null>(null);
  const [rooms, setRooms] = useState<IndexerProfileRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    getPlayerProfile(address)
      .then(({ player, rooms }) => {
        logger.log("[profile] player:", player, "rooms:", rooms.length);
        setPlayer(player);
        setRooms(rooms);
      })
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : String(e);
        logger.error("[profile] Error:", msg);
        setError(msg);
      })
      .finally(() => setLoading(false));
  }, [address]);

  function handleCopy() {
    navigator.clipboard.writeText(address).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const winRate =
    player && Number(player.totalGames) > 0
      ? Math.round((Number(player.wins) / Number(player.totalGames)) * 100)
      : 0;

  const diceStats = computeDiceStats(rooms, address);
  const avgDuration = computeAvgDuration(rooms);

  return (
    <div className="flex flex-col gap-6">
      <WalletBar />

      <header className="flex items-center justify-between pt-2">
        <Link href="/" className="text-sm text-white/60">← Back</Link>
        <h1 className="text-lg font-semibold">Profile</h1>
        <div className="w-10" />
      </header>

      {/* Avatar + address + copy + streak */}
      <div className="flex flex-col items-center gap-2 pt-2">
        {loading ? (
          <Skeleton className="h-12 w-12 rounded-full" />
        ) : (
          <Identicon address={address} size={48} className="ring-2 ring-white/10" />
        )}

        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 rounded-lg px-2 py-0.5 transition-colors hover:bg-white/5 active:opacity-70"
          title="Copy address"
        >
          <span className="font-mono text-sm text-white">{truncateAddress(address)}</span>
          <span className="text-xs text-white/30">{copied ? "✓" : "⎘"}</span>
        </button>

        {!loading && player && Number(player.currentStreak) > 0 && (
          <span className="text-sm text-orange-400">
            🔥 {player.currentStreak} win streak
          </span>
        )}
      </div>

      {/* Stat cards */}
      {loading ? (
        <div className="grid grid-cols-4 gap-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex flex-col items-center gap-1.5 rounded-xl bg-white/5 py-3">
              <Skeleton className="h-5 w-8" />
              <Skeleton className="h-3 w-10" />
            </div>
          ))}
        </div>
      ) : player ? (
        <>
          <div className="grid grid-cols-4 gap-2">
            <StatCard value={player.totalGames} label="games" />
            <StatCard value={player.wins} label="wins" />
            <StatCard value={`${winRate}%`} label="rate" />
            <StatCard value={player.currentStreak} label="streak 🔥" />
          </div>

          {/* Outcome bar */}
          <OutcomeBar
            wins={Number(player.wins)}
            losses={Number(player.losses)}
            ties={Number(player.ties)}
          />

          {Number(player.longestStreak) > 0 && (
            <p className="text-center text-xs text-white/30">
              Longest streak: {player.longestStreak}
            </p>
          )}
        </>
      ) : (
        !loading && (
          <p className="pt-4 text-center text-sm text-white/40">No games played yet.</p>
        )
      )}

      {/* Dice stats */}
      {!loading && diceStats && (
        <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
          <p className="mb-2 text-xs font-semibold text-white/50">Dice stats</p>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-sm font-bold text-white">{diceStats.avg}</p>
              <p className="text-xs text-white/40">avg die</p>
            </div>
            <div>
              <p className="text-sm font-bold text-white">
                {diceStats.bestHand.d1}+{diceStats.bestHand.d2}
              </p>
              <p className="text-xs text-white/40">best hand</p>
            </div>
            <div>
              <p className="text-sm font-bold text-white">{diceStats.lucky}</p>
              <p className="text-xs text-white/40">lucky №</p>
            </div>
          </div>
          {avgDuration && (
            <p className="mt-2 text-center text-xs text-white/30">
              Avg game duration: {avgDuration}
            </p>
          )}
        </div>
      )}

      {/* Recent games */}
      {!loading && rooms.length > 0 && (
        <>
          <h2 className="text-sm font-semibold text-white/60">Recent games</h2>
          <ul className="flex flex-col gap-2">
            {rooms.map((room) => (
              <GameRow key={room.id} room={room} address={address} />
            ))}
          </ul>
        </>
      )}

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">
          {error}
        </div>
      )}
    </div>
  );
}
