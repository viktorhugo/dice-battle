"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatUnits } from "viem";
import { useConnection, usePublicClient } from "wagmi";
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
import { DICE_BATTLE_ABI } from "@/lib/abi";
import { getTokenDecimals, GAME_ADDRESS, ROOM_STATE } from "@/lib/constants";
import { truncateAddress, getTokenSymbol } from "@/lib/utils";
import { getOpenRoomsPage, type IndexerRoom } from "@/lib/indexer";
import { clearSecret } from "@/lib/commitment";
import { logger } from "@/lib/logger";

const PAGE_SIZE = 10;
const SECRET_PREFIX = "dice-battle:secret:";

type ActiveRoom = {
  id: string;
  state: typeof ROOM_STATE.OPEN | typeof ROOM_STATE.MATCHED;
};

type Tab = "browse" | "mine";

function getStoredRoomIds(): string[] {
  if (typeof window === "undefined") return [];
  const ids: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(SECRET_PREFIX)) {
        ids.push(key.slice(SECRET_PREFIX.length));
      }
    }
  } catch {
    // ignore (Safari private mode, etc.)
  }
  return ids;
}

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
  const publicClient = usePublicClient();
  const { address } = useConnection();

  const [tab, setTab] = useState<Tab>("browse");

  const [rooms, setRooms] = useState<IndexerRoom[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [browseError, setBrowseError] = useState<string | null>(null);

  const [myRooms, setMyRooms] = useState<ActiveRoom[]>([]);
  const [myRoomsLoading, setMyRoomsLoading] = useState(true);
  const [myPage, setMyPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const myTotalPages = Math.max(1, Math.ceil(myRooms.length / PAGE_SIZE));
  const myPagedRooms = myRooms.slice((myPage - 1) * PAGE_SIZE, myPage * PAGE_SIZE);

  useEffect(() => {
    setLoading(true);
    setBrowseError(null);
    getOpenRoomsPage(page, PAGE_SIZE, address ?? undefined)
      .then(({ rooms: data, total: count }) => {
        logger.log("[rooms] page", page, "rooms:", data.length, "total:", count);
        setRooms(data);
        setTotal(count);
      })
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : String(e);
        logger.error("[rooms] Error consultando indexer:", msg);
        setBrowseError(msg);
      })
      .finally(() => setLoading(false));
  }, [page, address]);

  useEffect(() => {
    const stored = getStoredRoomIds();
    if (!publicClient || stored.length === 0) {
      setMyRoomsLoading(false);
      return;
    }

    Promise.all(
      stored.map(async (id) => {
        try {
          const result = (await publicClient.readContract({
            address: GAME_ADDRESS,
            abi: DICE_BATTLE_ABI,
            functionName: "rooms",
            args: [BigInt(id)],
          })) as readonly [unknown, unknown, unknown, unknown, unknown, unknown, number];

          const state = result[6];
          if (state === ROOM_STATE.OPEN || state === ROOM_STATE.MATCHED) {
            return { id, state } as ActiveRoom;
          }
          clearSecret(id);
          return null;
        } catch {
          return { id, state: ROOM_STATE.OPEN } as ActiveRoom;
        }
      })
    ).then((results) => {
      setMyRooms(results.filter((r): r is ActiveRoom => r !== null));
      setMyRoomsLoading(false);
    });
  }, [publicClient]);

  function goTo(p: number) {
    if (p < 1 || p > totalPages || p === page) return;
    setPage(p);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function goToMyPage(p: number) {
    if (p < 1 || p > myTotalPages || p === myPage) return;
    setMyPage(p);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const pageRange = buildPageRange(page, totalPages);
  const myPageRange = buildPageRange(myPage, myTotalPages);

  return (
    <div className="flex flex-col gap-6 pb-32">
      <WalletBar />

      <header className="flex items-center justify-between pt-2">
        <Link href="/" className="text-sm text-white/60">← Back</Link>
        <h1 className="text-lg font-semibold">Rooms</h1>
        <div className="w-10" />
      </header>

      {/* Tab switcher */}
      <div className="flex rounded-xl border border-white/10 bg-white/5 p-1">
        <button
          type="button"
          onClick={() => setTab("browse")}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition-colors ${
            tab === "browse"
              ? "bg-white/10 text-white"
              : "text-white/40 hover:text-white/60"
          }`}
        >
          Browse
          {!loading && total > 0 && (
            <span className={`text-xs ${tab === "browse" ? "text-white/50" : "text-white/25"}`}>
              {total}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setTab("mine")}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition-colors ${
            tab === "mine"
              ? "bg-white/10 text-white"
              : "text-white/40 hover:text-white/60"
          }`}
        >
          My rooms
          {!myRoomsLoading && myRooms.length > 0 && (
            <span className={`text-xs ${tab === "mine" ? "text-celo-yellow" : "text-celo-yellow/50"}`}>
              {myRooms.length}
            </span>
          )}
        </button>
      </div>

      {/* Browse tab */}
      {tab === "browse" && (
        <div className="flex flex-col gap-3">
          {loading && (
            <ul className="flex flex-col gap-3">
              {Array.from({ length: 5 }).map((_, i) => (
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

          {browseError && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">
              {browseError}
            </div>
          )}

          {!loading && !browseError && rooms.length === 0 && (
            <div className="pt-10 text-center text-sm text-white/50">
              No open rooms from other players.{" "}
              <Link href="/create" className="text-celo-yellow underline">Create one!</Link>
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
                <Pagination className="mt-2">
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious onClick={() => goTo(page - 1)} disabled={page === 1} />
                    </PaginationItem>
                    {pageRange.map((item, idx) =>
                      item === "ellipsis" ? (
                        <PaginationItem key={`ellipsis-${idx}`}>
                          <PaginationEllipsis />
                        </PaginationItem>
                      ) : (
                        <PaginationItem key={item}>
                          <PaginationLink isActive={item === page} onClick={() => goTo(item)}>
                            {item}
                          </PaginationLink>
                        </PaginationItem>
                      )
                    )}
                    <PaginationItem>
                      <PaginationNext onClick={() => goTo(page + 1)} disabled={page === totalPages} />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              )}
            </>
          )}
        </div>
      )}

      {/* My rooms tab */}
      {tab === "mine" && (
        <div className="flex flex-col gap-3">
          {myRoomsLoading && (
            <ul className="flex flex-col gap-3">
              {[0, 1].map((i) => (
                <li key={i}>
                  <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                    <div className="flex flex-col gap-1.5">
                      <Skeleton className="h-3 w-16" />
                      <Skeleton className="h-3 w-28" />
                    </div>
                    <Skeleton className="h-4 w-20" />
                  </div>
                </li>
              ))}
            </ul>
          )}

          {!myRoomsLoading && myRooms.length === 0 && (
            <div className="pt-10 text-center text-sm text-white/50">
              You have no active rooms.{" "}
              <Link href="/create" className="text-celo-yellow underline">Create one!</Link>
            </div>
          )}

          {!myRoomsLoading && myRooms.length > 0 && (
            <>
              <ul className="flex flex-col gap-3">
                {myPagedRooms.map((room) => (
                  <li key={room.id}>
                    <Link
                      href={room.state === ROOM_STATE.MATCHED ? `/game/${room.id}` : `/join/${room.id}`}
                      className="flex items-center justify-between rounded-2xl border border-celo-yellow/20 bg-celo-yellow/5 px-4 py-4 active:opacity-70"
                    >
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs text-white/40">Room #{room.id}</span>
                        <span className={`text-xs font-medium ${
                          room.state === ROOM_STATE.MATCHED ? "text-celo-yellow" : "text-white/50"
                        }`}>
                          {room.state === ROOM_STATE.MATCHED ? "⚡ Ready to reveal" : "⏳ Waiting for opponent"}
                        </span>
                      </div>
                      <span className="text-sm font-semibold text-celo-yellow">
                        {room.state === ROOM_STATE.MATCHED ? "Roll dice →" : "View room →"}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>

              {myTotalPages > 1 && (
                <Pagination className="mt-2">
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious onClick={() => goToMyPage(myPage - 1)} disabled={myPage === 1} />
                    </PaginationItem>
                    {myPageRange.map((item, idx) =>
                      item === "ellipsis" ? (
                        <PaginationItem key={`ellipsis-${idx}`}>
                          <PaginationEllipsis />
                        </PaginationItem>
                      ) : (
                        <PaginationItem key={item}>
                          <PaginationLink isActive={item === myPage} onClick={() => goToMyPage(item)}>
                            {item}
                          </PaginationLink>
                        </PaginationItem>
                      )
                    )}
                    <PaginationItem>
                      <PaginationNext onClick={() => goToMyPage(myPage + 1)} disabled={myPage === myTotalPages} />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              )}
            </>
          )}

          {address && (
            <Link
              href={`/profile/${address}`}
              className="mt-2 block text-center text-xs text-white/30 underline underline-offset-2 active:text-white/60"
            >
              View your full game history →
            </Link>
          )}
        </div>
      )}

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
