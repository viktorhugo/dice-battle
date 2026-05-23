import { Suspense } from "react";
import Link from "next/link";
import { Medal } from "lucide-react";
import { WalletBar } from "@/components/WalletBar";
import { LiveStats } from "@/components/social/LiveStats";
import { Skeleton } from "@/components/ui/skeleton";

export default function Home() {
  return (
    <div className="flex flex-col gap-6">
      <WalletBar />

      <header className="flex flex-col items-center gap-2 pt-10 text-center">
        <div className="text-6xl" aria-hidden>
          🎲
        </div>
        <h1 className="text-3xl font-bold">Dice Battle</h1>
        <p className="max-w-xs text-sm text-white/60">
          PvP dice battle. Stake stablecoins, roll the dice, winner takes the pot.
        </p>
      </header>

      <Suspense fallback={
        <div className="grid grid-cols-3 gap-2 rounded-xl border border-white/10 bg-white/5 p-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex flex-col items-center gap-1.5">
              <Skeleton className="h-4 w-8" />
              <Skeleton className="h-2.5 w-16" />
            </div>
          ))}
        </div>
      }>

      <LiveStats />

      </Suspense>

      <div className="grid gap-3">
        <Link
          href="/create"
          className="rounded-2xl bg-celo-yellow py-4 text-center font-semibold text-celo-dark active:opacity-80"
        >
          Create a room
        </Link>
        <Link
          href="/rooms"
          className="rounded-2xl border border-white/15 py-4 text-center font-semibold text-white active:opacity-80"
        >
          Browse open rooms
        </Link>
        <Link
          href="/leaderboard"
          className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 py-4 text-center font-semibold text-white/80 active:opacity-80"
        >
          <Medal />  Leaderboard
        </Link>
      </div>

      <section className="pt-8">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-white/50">
          How it works
        </h2>
        <ol className="space-y-2 text-sm text-white/70">
          <li>
            <span className="font-semibold text-white">1.</span> Create a room with your stake
            (USDm or USDT).
          </li>
          <li>
            <span className="font-semibold text-white">2.</span> Share the link with a friend.
            They match the stake to join.
          </li>
          <li>
            <span className="font-semibold text-white">3.</span> Reveal your secret. The contract
            rolls two dice using onchain entropy.
          </li>
          <li>
            <span className="font-semibold text-white">4.</span> Higher roll wins the pot (2% fee).
            Ties refund everyone.
          </li>
        </ol>
      </section>

      <footer className="pt-8 text-center text-[10px] text-white/30">
        Built for MiniPay on Celo · Proof of Ship April 2026
      </footer>
    </div>
  );
}
