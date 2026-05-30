import type { NextRequest } from "next/server";
import { createPublicClient, createWalletClient, http, isAddress, getAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { celo } from "viem/chains";
import { TOURNAMENT_ADDRESS, TOURNAMENT_ABI } from "@/lib/constants";
import { getLeaderboardPeriod } from "@/lib/indexer";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as `0x${string}`;

export async function GET(request: NextRequest) {
  // Verify Vercel sends Authorization: Bearer <CRON_SECRET>
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  if (TOURNAMENT_ADDRESS === ZERO_ADDRESS) {
    return Response.json(
      { error: "NEXT_PUBLIC_TOURNAMENT_ADDRESS not configured" },
      { status: 500 }
    );
  }

  const rawKey = process.env.TOURNAMENT_OWNER_PRIVATE_KEY;
  if (!rawKey) {
    return Response.json(
      { error: "TOURNAMENT_OWNER_PRIVATE_KEY not set" },
      { status: 500 }
    );
  }

  // This cron runs Sunday 00:00 UTC (schedule: "0 0 * * 0").
  // Yesterday = Saturday = the day we finalize for the weekly tournament.
  const nowSeconds  = Math.floor(Date.now() / 1000);
  const todayDayId  = Math.floor(nowSeconds / 86_400);
  const saturdayId  = todayDayId - 1; // Saturday's dayId (just ended at midnight)
  const weekStart   = (saturdayId - 6) * 86_400; // Last Sunday 00:00 UTC (7-day window)

  const publicClient = createPublicClient({ chain: celo, transport: http() });

  // Idempotency: skip if this Saturday was already finalized
  const info = await publicClient.readContract({
    address: TOURNAMENT_ADDRESS,
    abi: TOURNAMENT_ABI,
    functionName: "dayInfo",
    args: [BigInt(saturdayId)],
  });
  if (info[1]) {
    return Response.json({ skipped: true, reason: "Already finalized", saturdayId });
  }

  // Query the full week's leaderboard from the Envio indexer (Sun–Sat)
  const entries = await getLeaderboardPeriod(weekStart);

  if (entries.length === 0) {
    return Response.json({ skipped: true, reason: "No games played this week", saturdayId });
  }

  // Primary: wins desc (required by contract — winCounts must be non-increasing).
  // Tiebreaker: winRate desc. Minimum 5 games to qualify.
  const MIN_GAMES = 5;

  const top3 = entries
    .filter((e) => e.totalGames >= MIN_GAMES)
    .sort((a, b) => b.wins - a.wins || b.winRate - a.winRate)
    .slice(0, 3);

  // Validate and checksum addresses from indexer before submitting on-chain
  const toAddress = (addr: string | undefined): `0x${string}` => {
    if (!addr) return ZERO_ADDRESS;
    if (!isAddress(addr)) return ZERO_ADDRESS;
    return getAddress(addr);
  };

  // Build fixed-length arrays (pad with zero address if < 3 players)
  const topAddresses = [
    toAddress(top3[0]?.address),
    toAddress(top3[1]?.address),
    toAddress(top3[2]?.address),
  ] as const;

  const winCounts = [
    top3[0]?.wins ?? 0,
    top3[1]?.wins ?? 0,
    top3[2]?.wins ?? 0,
  ] as const;

  // Sign and submit setTopWinners for Saturday's dayId
  const account = privateKeyToAccount(rawKey as `0x${string}`);
  const walletClient = createWalletClient({ account, chain: celo, transport: http() });

  const hash = await walletClient.writeContract({
    address: TOURNAMENT_ADDRESS,
    abi: TOURNAMENT_ABI,
    functionName: "setTopWinners",
    args: [BigInt(saturdayId), topAddresses, winCounts],
  });

  await publicClient.waitForTransactionReceipt({ hash, timeout: 50_000 });

  return Response.json({
    success: true,
    saturdayId,
    top: topAddresses,
    winCounts,
    hash,
  });
}
