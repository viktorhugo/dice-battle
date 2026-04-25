import Link from "next/link";
import { WalletBar } from "@/components/WalletBar";

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

      <div className="grid gap-3 pt-6">
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
      </div>

      <section className="pt-8">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-white/50">
          How it works
        </h2>
        <ol className="space-y-2 text-sm text-white/70">
          <li>
            <span className="font-semibold text-white">1.</span> Create a room with your stake
            (cUSD or USDT).
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
