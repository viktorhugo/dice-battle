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

function StatCard({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl bg-white/5 py-3">
      <span className="text-base font-bold text-white">{value}</span>
      <span className="text-xs text-white/40">{label}</span>
    </div>
  );
}

function GameRow({
  room,
  address,
}: {
  room: IndexerProfileRoom;
  address: string;
}) {
  const addrLower = address.toLowerCase();
  const opponent =
    room.playerA === addrLower ? room.playerB : room.playerA;

  const isWin = room.state === "RESOLVED" && room.winner === addrLower;
  const isTie = room.state === "TIED";
  const isLoss = room.state === "RESOLVED" && !isWin;
  const isExpired = room.state === "EXPIRED";

  const resultLabel = isTie
    ? "Tied"
    : isWin
    ? "Won"
    : isLoss
    ? "Lost"
    : isExpired
    ? "Expired"
    : room.state;

  const resultColor = isTie
    ? "text-yellow-400"
    : isWin
    ? "text-green-400"
    : isLoss
    ? "text-red-400"
    : "text-white/40";

  const amount = formatUnits(
    BigInt(room.stake),
    getTokenDecimals(room.token as `0x${string}`)
  );
  const symbol = getTokenSymbol(room.token);

  return (
    <li className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3">
      <span className={`w-14 text-sm font-semibold ${resultColor}`}>
        {resultLabel}
      </span>
      <span className="text-sm text-white">
        {amount} {symbol}
      </span>
      <span className="font-mono text-xs text-white/40">
        {opponent ? truncateAddress(opponent) : "—"}
      </span>
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

  const winRate =
    player && Number(player.totalGames) > 0
      ? Math.round((Number(player.wins) / Number(player.totalGames)) * 100)
      : 0;

  return (
    <div className="flex flex-col gap-6">
      <WalletBar />

      <header className="flex items-center justify-between pt-2">
        <Link href="/" className="text-sm text-white/60">
          ← Back
        </Link>
        <h1 className="text-lg font-semibold">Profile</h1>
        <div className="w-10" />
      </header>

      {/* Avatar + address + streak */}
      <div className="flex flex-col items-center gap-2 pt-2">
        {loading ? (
          <Skeleton className="h-12 w-12 rounded-full" />
        ) : (
          <Identicon address={address} size={48} className="ring-2 ring-white/10" />
        )}
        <span className="font-mono text-sm text-white">
          {truncateAddress(address)}
        </span>
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
            <div
              key={i}
              className="flex flex-col items-center gap-1.5 rounded-xl bg-white/5 py-3"
            >
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
          {Number(player.longestStreak) > 0 && (
            <p className="text-center text-xs text-white/30">
              Longest streak: {player.longestStreak}
            </p>
          )}
        </>
      ) : (
        !loading && (
          <p className="pt-4 text-center text-sm text-white/40">
            No games played yet.
          </p>
        )
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
