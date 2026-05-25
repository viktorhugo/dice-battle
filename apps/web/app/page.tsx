import { Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { Medal, Search, Zap, ShieldCheck, Blocks, BanknoteArrowUp, Globe } from "lucide-react";
import { WalletBar } from "@/components/WalletBar";
import { LiveStats } from "@/components/social/LiveStats";
import { Skeleton } from "@/components/ui/skeleton";

const TRUST_BADGES = [
  { label: "Provably Fair",  Icon: ShieldCheck,      accent: "#00C4B3" },
  { label: "Fully On-Chain", Icon: Blocks,           accent: "#FCFF52" },
  { label: "Instant Payouts",Icon: BanknoteArrowUp,  accent: "#00C4B3" },
  { label: "Built on Celo",  Icon: Globe,            accent: "#FCFF52" },
];

const HOW_IT_WORKS = [
  { n: "01", title: "Create & Stake",   desc: "Set your bet in USDm or USDT and open a room.",                          accent: "#FCFF52" },
  { n: "02", title: "Opponent Joins",   desc: "Share the link — they match your stake to lock in.",                      accent: "#00C4B3" },
  { n: "03", title: "Roll On-Chain",    desc: "Reveal your secret. The contract generates entropy onchain.",             accent: "#FCFF52" },
  { n: "04", title: "Winner Takes Pot", desc: "Higher roll wins. Ties refund both players. 2% protocol fee.",            accent: "#00C4B3" },
] as const;

export default function Home() {
  return (
    <div className="flex flex-col gap-5 pb-10">
      <WalletBar />

      {/* ── Hero ── */}
      <header className="relative flex flex-col items-center gap-5 text-center overflow-hidden" style={{ borderRadius: "100px 1px 100px 40px" }}>
        {/* Glow amarillo detrás dado izquierdo */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-[5%] top-[20%] h-44 w-44 rounded-full blur-3xl opacity-30"
          style={{ background: "#FCFF52" }}
        />
        {/* Glow cyan detrás dado derecho */}
        <div
          aria-hidden
          className="pointer-events-none absolute right-[5%] top-[20%] h-44 w-44 rounded-full blur-3xl opacity-25"
          style={{ background: "#00C4B3" }}
        />

        {/* Hero image */}
        <div className="relative z-10 w-full">
          <Image
            src="/images/dices.png"
            alt="Dice Battle — dados enfrentados"
            width={1536}
            height={1024}
            priority
            className="mx-auto w-full object-contain mix-blend-screen"
            style={{
              maskImage: "radial-gradient(ellipse 80% 75% at 50% 50%, black 35%, transparent 100%)",
              WebkitMaskImage: "radial-gradient(ellipse 80% 75% at 50% 50%, black 35%, transparent 100%)",
            }}
          />
        </div>

        {/* Title + tagline */}
        <div className="z-10 flex flex-col items-center gap-1 -mt-[50px]">
          <h1 className="font-heading text-[3rem] font-bold leading-none tracking-tight">
            <span style={{ color: "#FCFF52" }}>Dice</span>
            <span className="text-white"> Battle</span>
          </h1>

          <p className="font-heading text-base font-semibold tracking-widest text-white/70">
            Roll.&nbsp; Risk.&nbsp; Win.
          </p>

          <p className="mx-auto mt-1.5 max-w-[250px] text-[13px] leading-relaxed text-white/35">
            Stake stablecoins, roll on-chain, winner takes the pot.
          </p>
        </div>
      </header>

      {/* ── Trust Badges — marquee ── */}
      <div className="overflow-hidden -mx-4" aria-hidden>
        <div className="flex w-max gap-2 animate-marquee">
          {[...TRUST_BADGES, ...TRUST_BADGES].map(({ label, Icon, accent }, i) => (
            <span
              key={i}
              className="shrink-0 flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 font-mono text-[10px] text-white/50 backdrop-blur-sm"
            >
              <Icon className="h-2.5 w-2.5 shrink-0" style={{ color: accent }} />
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* ── Live Stats ── */}
      <Suspense
        fallback={
          <div className="grid grid-cols-3 gap-2 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex flex-col items-center gap-2">
                <Skeleton className="h-4 w-10" />
                <Skeleton className="h-2.5 w-16" />
              </div>
            ))}
          </div>
        }
      >
      
      <LiveStats />
      
      </Suspense>

      {/* ── CTA Bento Grid ── */}
      <div className="grid grid-cols-2 gap-3">
        {/* Primary CTA — full width, glowing */}
        <Link
          href="/create"
          className="col-span-2 group relative cursor-pointer overflow-hidden rounded-2xl py-[18px] text-center text-[#0C0C0C] transition-transform duration-150 active:scale-[0.97] animate-btn-glow"
          style={{ background: "#FCFF52" }}
        >
          <span className="relative z-10 flex items-center justify-center gap-2 font-heading text-[15px] font-semibold">
            <Zap className="h-5 w-5 fill-current" />
            Create a Room
          </span>
          <span
            aria-hidden
            className="absolute inset-0 bg-black/0 transition-colors duration-150 group-active:bg-black/10"
          />
        </Link>

        {/* Browse Rooms */}
        <Link
          href="/rooms"
          className="group cursor-pointer overflow-hidden rounded-2xl border border-white/10 bg-white/5 py-5 text-center backdrop-blur-sm transition-all duration-200 active:scale-[0.97] hover:border-[#00C4B3]/40"
        >
          <span className="flex flex-col items-center gap-2">
            <Search className="h-5 w-5" style={{ color: "#00C4B3" }} />
            <span className="font-heading text-sm font-semibold text-white">Browse Rooms</span>
          </span>
        </Link>

        {/* Leaderboard */}
        <Link
          href="/leaderboard"
          className="group cursor-pointer overflow-hidden rounded-2xl border border-white/10 bg-white/5 py-5 text-center backdrop-blur-sm transition-all duration-200 active:scale-[0.97] hover:border-[#FCFF52]/40"
        >
          <span className="flex flex-col items-center gap-2">
            <Medal className="h-5 w-5" style={{ color: "#FCFF52" }} />
            <span className="font-heading text-sm font-semibold text-white">Leaderboard</span>
          </span>
        </Link>
      </div>

      {/* ── How it works ── */}
      <section className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
        <h2 className="mb-5 font-heading text-[10px] font-bold uppercase tracking-widest text-white/30">
          How it works
        </h2>

        <div className="space-y-5">
          {HOW_IT_WORKS.map(({ n, title, desc, accent }) => (
            <div key={n} className="flex items-start gap-4">
              <span className="mt-0.5 shrink-0 font-mono text-[11px] font-semibold" style={{ color: accent }}>
                {n}
              </span>
              <div>
                <p className="font-heading text-sm font-semibold text-white">{title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-white/40">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="pt-2 text-center font-mono text-[10px] text-white/20">
        Built for MiniPay on Celo · Proof of Ship 2026
      </footer>
    </div>
  );
}
