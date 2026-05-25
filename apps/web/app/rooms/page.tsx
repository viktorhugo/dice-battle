"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
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
import { truncateAddress, getTokenSymbol, getTokenIcon, timeAgo, formatDate } from "@/lib/utils";
import Image from "next/image";
import { getOpenRoomsPage, getRoomsCreatedAt, type IndexerRoom } from "@/lib/indexer";
import { clearSecret } from "@/lib/commitment";
import { Zap } from "lucide-react";
import { BorderBeam } from "@/components/ui/border-beam";
import { logger } from "@/lib/logger";

const PAGE_SIZE = 10;
const SECRET_PREFIX = "dice-battle:secret:";

type ActiveRoom = {
  id: string;
  state: typeof ROOM_STATE.OPEN | typeof ROOM_STATE.MATCHED;
  token?: string;
  stake?: bigint;
  createdAt?: number;
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
  const searchParams = useSearchParams();

  const [tab, setTab] = useState<Tab>(
    searchParams.get("tab") === "mine" ? "mine" : "browse"
  );

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
          })) as readonly [`0x${string}`, `0x${string}`, `0x${string}`, bigint, bigint, `0x${string}`, number];

          const state = result[6];
          if (state === ROOM_STATE.OPEN || state === ROOM_STATE.MATCHED) {
            return { id, state, token: result[2], stake: result[3] } as ActiveRoom;
          }
          clearSecret(id);
          return null;
        } catch {
          return { id, state: ROOM_STATE.OPEN } as ActiveRoom;
        }
      })
    ).then(async (results) => {
      const active = results.filter((r): r is ActiveRoom => r !== null);
      try {
        const timestamps = await getRoomsCreatedAt(active.map((r) => r.id));
        const withDates = active.map((r) => ({ ...r, createdAt: timestamps[r.id] }));
        withDates.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
        setMyRooms(withDates);
      } catch {
        setMyRooms(active);
      }
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
                {rooms.map((room) => {
                  const amount = formatUnits(BigInt(room.stake), getTokenDecimals(room.token as `0x${string}`));
                  const symbol = getTokenSymbol(room.token);
                  const badgeCls =
                    symbol === "USDC"
                      ? "bg-blue-500/15 border border-blue-400/30 text-blue-200"
                      : symbol === "USDT"
                      ? "bg-teal-500/15 border border-teal-400/30 text-teal-200"
                      : "bg-[#5118C1]/15 border border-[#5118C1]/30 text-purple-200";
                  const cardBorder =
                    symbol === "USDC"
                      ? "border-blue-500/20 border-2 hover:border-blue-400/35"
                      : symbol === "USDT"
                      ? "border-teal-500/20 border-2 hover:border-teal-400/35"
                      : "border-[#5118C1]/20 border-2 hover:border-[#5118C1]/35";
                  return (
                    <li key={room.id}>
                      <Link
                        href={`/join/${room.id}`}
                        className={`relative flex items-center justify-between overflow-hidden rounded-2xl border bg-zinc-900/80 px-4 py-3.5 backdrop-blur-md transition-all duration-200 active:opacity-70 ${cardBorder}`}
                      >
                        {/* Watermark izquierdo */}
                        <Image
                          src={getTokenIcon(room.token)}
                          alt=""
                          width={90}
                          height={90}
                          className="pointer-events-none absolute -right-[45px] top-1/2 -translate-y-1/2 select-none opacity-70"
                          aria-hidden
                        />

                        {/* Nivel 2 + 3 + 4 */}
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm font-semibold tracking-wide text-white">
                            Room #{room.id}
                          </span>
                          <span className="text-xs">
                            <span className="text-zinc-600">by </span>
                            <span className="font-mono text-zinc-400">{truncateAddress(room.playerA)}</span>
                          </span>
                          <div className={`flex items-center mt-1 gap-1.5 rounded-md px-2.5 py-1 font-bold backdrop-blur-sm ${badgeCls}`}>
                            <Image
                              src={getTokenIcon(room.token)}
                              alt={symbol}
                              width={18}
                              height={18}
                              className="rounded-full"
                            />
                            <span className="text-sm">{amount} {symbol}</span>
                          </div>
                        </div>

                        {/* Fecha de creación */}
                        <div className="flex flex-col items-end gap-1 z-10">
                          <span className="text-xs font-medium text-zinc-300 z-10 rounded-full bg-zinc-900/30 px-3 py-1 backdrop-blur-sm">
                            {formatDate(Number(room.createdAt))}
                          </span>
                          <span className="text-[11px] text-zinc-500 z-10 rounded-full bg-zinc-900/30 px-3 py-0.5 backdrop-blur-sm">
                            ({timeAgo(Number(room.createdAt))})
                          </span>
                        </div>
                      </Link>
                    </li>
                  );
                })}
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
                {myPagedRooms.map((room) => {
                  const isMatched = room.state === ROOM_STATE.MATCHED;
                  const cardBorder = isMatched
                    ? "border-amber-500/35 border-2 hover:border-amber-400/55"
                    : "border-zinc-700/40 border-2 hover:border-zinc-500/60";
                  const symbol = room.token ? getTokenSymbol(room.token) : null;
                  return (
                    <li key={room.id}>
                      <Link
                        href={isMatched ? `/game/${room.id}` : `/join/${room.id}`}
                        className={`relative flex items-center justify-between overflow-hidden rounded-2xl border bg-zinc-900/80 px-4 py-3.5 backdrop-blur-md transition-all duration-200 active:opacity-70 ${cardBorder}`}
                      >
                        {/* Watermark derecho — mitad visible */}
                        {room.token && (
                          <Image
                            src={getTokenIcon(room.token)}
                            alt=""
                            width={90}
                            height={90}
                            className="pointer-events-none absolute -right-[45px] top-1/2 -translate-y-1/2 select-none opacity-70"
                            aria-hidden
                          />
                        )}

                        {/* Izquierda: jerarquía de texto */}
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm font-semibold tracking-wide text-white">
                            Room #{room.id}
                          </span>
                          <span className={`text-xs font-medium ${isMatched ? "text-amber-400" : "text-zinc-400"}`}>
                            {isMatched ? "⚡ Ready to reveal" : "⏳ Waiting for opponent"}
                          </span>
                          {room.token && room.stake != null && symbol && (
                            <span className="text-xs mt-1 text-zinc-500 flex items-center gap-1.5 rounded-full py-1 font-bold backdrop-blur-sm">
                              <Image
                                src={getTokenIcon(room.token)}
                                alt={symbol}
                                width={18}
                                height={18}
                                className="rounded-full"
                              />
                              {formatUnits(room.stake, getTokenDecimals(room.token as `0x${string}`))} {symbol} each
                            </span>
                          )}
                          {room.createdAt && (
                            <span className="text-[11px] text-zinc-600 mt-0.5">
                              {formatDate(room.createdAt)} ({timeAgo(room.createdAt)})
                            </span>
                          )}
                        </div>

                        {/* Derecha: CTA */}
                        <span className={`relative z-10 rounded-full bg-zinc-900/30 px-3 py-1 text-sm font-semibold backdrop-blur ${isMatched ? "text-amber-400" : "text-zinc-400"}`}>
                          {isMatched ? "Roll dice →" : "View →"}
                        </span>

                        {/* Dual BorderBeam solo en cards listas para revelar */}
                        {isMatched && (
                          <>
                            <BorderBeam
                              colorFrom="#FCFF52"
                              colorTo="#00C4B3"
                              duration={3}
                              size={80}
                              borderWidth={2}
                            />
                            <BorderBeam
                              colorFrom="#00C4B3"
                              colorTo="#FCFF52"
                              duration={3}
                              size={80}
                              borderWidth={2}
                              reverse
                              initialOffset={50}
                            />
                          </>
                        )}
                      </Link>
                    </li>
                  );
                })}
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
            className="group relative overflow-hidden flex items-center justify-center gap-2 w-full rounded-2xl py-[18px] font-heading text-[15px] font-semibold text-[#0C0C0C] transition-transform duration-150 active:scale-[0.97] animate-btn-glow"
            style={{ background: "#FCFF52" }}
          >
            <span aria-hidden className="absolute inset-0 bg-black/0 transition-colors duration-150 group-active:bg-black/10" />
            <span className="relative z-10 flex items-center gap-2">
              <Zap className="h-5 w-5 fill-current" />
              Create a room
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}
