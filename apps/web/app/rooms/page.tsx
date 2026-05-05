"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatUnits } from "viem";
import { WalletBar } from "@/components/WalletBar";
import { Skeleton } from "@/components/ui/skeleton";
import { getTokenDecimals } from "@/lib/constants";
import { truncateAddress, getTokenSymbol } from "@/lib/utils";
import { getOpenRooms, type IndexerRoom } from "@/lib/indexer";
import { logger } from "@/lib/logger";

export default function RoomsPage() {
  const [rooms, setRooms] = useState<IndexerRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getOpenRooms()
      .then((data) => {
        logger.log("[rooms] Salas abiertas del indexer:", data.length);
        setRooms(data);
      })
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : String(e);
        logger.error("[rooms] Error consultando indexer:", msg);
        setError(msg);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <WalletBar />

      <header className="flex items-center justify-between pt-2">
        <Link href="/" className="text-sm text-white/60">
          ← Back
        </Link>
        <h1 className="text-lg font-semibold">Open rooms</h1>
        <div className="w-10" />
      </header>

      {loading && (
        <ul className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <li key={i}>
              <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                <div className="flex flex-col gap-1.5">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">
          {error}
        </div>
      )}

      {!loading && !error && rooms.length === 0 && (
        <div className="pt-10 text-center text-sm text-white/50">
          No open rooms right now.{" "}
          <Link href="/create" className="text-celo-yellow underline">
            Create one!
          </Link>
        </div>
      )}

      {!loading && rooms.length > 0 && (
        <ul className="flex flex-col gap-3">
          {rooms.map((room) => (
            <li key={room.id}>
              <Link
                href={`/join/${room.id}`}
                className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-4 active:opacity-70"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs text-white/40">Room #{room.id}</span>
                  <span className="font-mono text-xs text-white/60">
                    {truncateAddress(room.playerA)}
                  </span>
                </div>
                <div className="flex flex-col items-end gap-0.5">
                  <span className="font-semibold text-white">
                    {formatUnits(BigInt(room.stake), getTokenDecimals(room.token as `0x${string}`))} {getTokenSymbol(room.token)}
                  </span>
                  <span className="text-xs text-white/40">each player</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {!loading && (
        <Link
          href="/create"
          className="rounded-2xl bg-celo-yellow py-4 text-center font-semibold text-celo-dark active:opacity-80"
        >
          Create a room
        </Link>
      )}
    </div>
  );
}
