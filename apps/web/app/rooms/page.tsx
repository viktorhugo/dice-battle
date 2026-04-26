"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { decodeEventLog, formatUnits } from "viem";
import { usePublicClient } from "wagmi";
import { WalletBar } from "@/components/WalletBar";
import { DICE_BATTLE_ABI } from "@/lib/abi";
import { GAME_ADDRESS, GAME_DEPLOY_BLOCK } from "@/lib/constants";
import { truncateAddress, getTokenSymbol } from "@/lib/utils";
import { logger } from "@/lib/logger";

type OpenRoom = {
  roomId: bigint;
  playerA: `0x${string}`;
  token: `0x${string}`;
  stake: bigint;
};

const CLOSED_EVENTS = new Set(["RoomJoined", "RoomResolved", "RoomTied", "RoomExpiredClaim", "RoomCancelled"]);

export default function RoomsPage() {
  const publicClient = usePublicClient();
  const [rooms, setRooms] = useState<OpenRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!publicClient) return;

    (async () => {
      try {
        const fromBlock = GAME_DEPLOY_BLOCK ?? 0n;
        logger.log("[rooms] Buscando salas — fromBlock:", fromBlock);

        const logs = await publicClient.getLogs({
          address: GAME_ADDRESS,
          fromBlock,
          toBlock: "latest",
        });

        logger.log("[rooms] Logs recibidos:", logs.length);

        const created = new Map<string, OpenRoom>();
        const closed = new Set<string>();

        for (const log of logs) {
          try {
            const decoded = decodeEventLog({ abi: DICE_BATTLE_ABI, data: log.data, topics: log.topics });
            const id = (decoded.args as Record<string, unknown>).roomId?.toString();
            if (!id) continue;

            if (decoded.eventName === "RoomCreated") {
              const args = decoded.args as {
                roomId: bigint;
                playerA: `0x${string}`;
                token: `0x${string}`;
                stake: bigint;
              };
              created.set(id, {
                roomId: args.roomId,
                playerA: args.playerA,
                token: args.token,
                stake: args.stake,
              });
            } else if (CLOSED_EVENTS.has(decoded.eventName)) {
              closed.add(id);
            }
          } catch {
            // log from another contract or unrecognised event
          }
        }

        const open = [...created.entries()]
          .filter(([id]) => !closed.has(id))
          .map(([, room]) => room)
          .reverse();

        logger.log("[rooms] Salas creadas:", created.size, "| cerradas:", closed.size, "| abiertas:", open.length);
        setRooms(open);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        logger.error("[rooms] Error cargando salas:", msg);
        setError(msg);
      } finally {
        setLoading(false);
      }
    })();
  }, [publicClient]);

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
        <p className="pt-10 text-center text-sm text-white/50">Loading rooms…</p>
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
            <li key={room.roomId.toString()}>
              <Link
                href={`/join/${room.roomId}`}
                className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-4 active:opacity-70"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs text-white/40">Room #{room.roomId.toString()}</span>
                  <span className="font-mono text-xs text-white/60">
                    {truncateAddress(room.playerA)}
                  </span>
                </div>
                <div className="flex flex-col items-end gap-0.5">
                  <span className="font-semibold text-white">
                    {formatUnits(room.stake, 18)} {getTokenSymbol(room.token)}
                  </span>
                  <span className="text-xs text-white/40">each player</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Link
        href="/create"
        className="rounded-2xl bg-celo-yellow py-4 text-center font-semibold text-celo-dark active:opacity-80"
      >
        Create a room
      </Link>
    </div>
  );
}
