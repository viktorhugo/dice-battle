"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatUnits } from "viem";
import { WalletBar } from "@/components/WalletBar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { getTokenDecimals } from "@/lib/constants";
import { truncateAddress, getTokenSymbol } from "@/lib/utils";
import { getOpenRoomsPage, type IndexerRoom } from "@/lib/indexer";
import { logger } from "@/lib/logger";

const PAGE_SIZE = 10;

function buildPageRange(current: number, total: number): (number | "ellipsis")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const pages: (number | "ellipsis")[] = [1];

  if (current > 3) pages.push("ellipsis");

  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let i = start; i <= end; i++) pages.push(i);

  if (current < total - 2) pages.push("ellipsis");

  pages.push(total);
  return pages;
}

export default function RoomsPage() {
  const [rooms, setRooms] = useState<IndexerRoom[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  useEffect(() => {
    setLoading(true);
    setError(null);
    getOpenRoomsPage(page, PAGE_SIZE)
      .then(({ rooms: data, total: count }) => {
        logger.log("[rooms] page", page, "rooms:", data.length, "total:", count);
        setRooms(data);
        setTotal(count);
      })
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : String(e);
        logger.error("[rooms] Error consultando indexer:", msg);
        setError(msg);
      })
      .finally(() => setLoading(false));
  }, [page]);

  function goTo(p: number) {
    if (p < 1 || p > totalPages || p === page) return;
    setPage(p);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const pageRange = buildPageRange(page, totalPages);

  return (
    <div className="flex flex-col gap-6 pb-32">
      <WalletBar />

      <header className="flex items-center justify-between pt-2">
        <Link href="/" className="text-sm text-white/60">
          ← Back
        </Link>
        <div className="flex flex-col items-center gap-0.5">
          <h1 className="text-lg font-semibold">Open rooms</h1>
          {!loading && (
            <p className="text-xs text-white/40">{total} available</p>
          )}
        </div>
        <div className="w-10" />
      </header>

      {loading && (
        <ul className="flex flex-col gap-3">
          {Array.from({ length: PAGE_SIZE }).map((_, i) => (
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
        <>
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
                      {formatUnits(
                        BigInt(room.stake),
                        getTokenDecimals(room.token as `0x${string}`)
                      )}{" "}
                      {getTokenSymbol(room.token)}
                    </span>
                    <span className="text-xs text-white/40">each player</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          {totalPages > 1 && (
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => goTo(page - 1)}
                    disabled={page === 1}
                  />
                </PaginationItem>

                {pageRange.map((item, idx) =>
                  item === "ellipsis" ? (
                    <PaginationItem key={`ellipsis-${idx}`}>
                      <PaginationEllipsis />
                    </PaginationItem>
                  ) : (
                    <PaginationItem key={item}>
                      <PaginationLink
                        isActive={item === page}
                        onClick={() => goTo(item)}
                      >
                        {item}
                      </PaginationLink>
                    </PaginationItem>
                  )
                )}

                <PaginationItem>
                  <PaginationNext
                    onClick={() => goTo(page + 1)}
                    disabled={page === totalPages}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}

        </>
      )}

      {/* Fixed create button */}
      <div className="fixed bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-[#0C0C0C] via-[#0C0C0C]/90 to-transparent px-4 pb-6 pt-10">
        <div className="mx-auto w-full max-w-md">
          <Link
            href="/create"
            className="block w-full rounded-2xl bg-celo-yellow py-4 text-center font-semibold text-celo-dark active:opacity-80"
          >
            Create a room
          </Link>
        </div>
      </div>
    </div>
  );
}
