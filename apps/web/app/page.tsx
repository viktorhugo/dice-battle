import { Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { Medal, Search, Zap, ShieldCheck, Blocks, BanknoteArrowUp, Globe, BarChart2, Trophy } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { WalletBar } from "@/components/WalletBar";
import { LiveStats } from "@/components/social/LiveStats";
import { QuickMatchButton } from "@/components/QuickMatchButton";
import { Skeleton } from "@/components/ui/skeleton";

export default async function Home() {
  const home = await getTranslations("home");
  const common = await getTranslations("common");

  const TRUST_BADGES = [
    { label: home("trust_provably_fair"),   Icon: ShieldCheck,      accent: "#00C4B3" },
    { label: home("trust_fully_onchain"),   Icon: Blocks,           accent: "#FCFF52" },
    { label: home("trust_instant_payouts"), Icon: BanknoteArrowUp,  accent: "#00C4B3" },
    { label: home("trust_built_on_celo"),   Icon: Globe,            accent: "#FCFF52" },
  ];

  const HOW_IT_WORKS = [
    { n: "01", title: home("step_01_title"), desc: home("step_01_desc"), accent: "#FCFF52" },
    { n: "02", title: home("step_02_title"), desc: home("step_02_desc"), accent: "#00C4B3" },
    { n: "03", title: home("step_03_title"), desc: home("step_03_desc"), accent: "#FCFF52" },
    { n: "04", title: home("step_04_title"), desc: home("step_04_desc"), accent: "#00C4B3" },
  ];

  return (
    <div className="flex flex-col gap-5 pb-10">
      <WalletBar />

      {/* ── Hero ── */}
      <header className="relative flex flex-col items-center gap-5 text-center overflow-hidden [mask-image:linear-gradient(to_bottom,transparent_0%,black_20%)]">
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
            src="/images/dices.webp"
            alt="Dice Battle — dados enfrentados"
            width={1536}
            height={1024}
            priority
            className="mx-auto w-full object-contain mix-blend-screen"
            style={{
              // maskImage: "radial-gradient(ellipse 80% 75% at 50% 50%, black 35%, transparent 100%)",
              // WebkitMaskImage: "radial-gradient(ellipse 80% 75% at 50% 50%, black 35%, transparent 100%)",
            }}
          />
        </div>

        {/* Title + tagline */}
        <div className="z-10 flex flex-col items-center gap-1 -mt-[50px]">
          <h1 className="font-heading text-[3rem] font-bold leading-none tracking-tight">
            <span style={{ color: "#FCFF52" }}>Dice</span>
            <span className="text-white"> Battle</span>
          </h1>

          <p className="font-heading text-base font-semibold tracking-widest text-white/80">
            {home("tagline")}
          </p>

          <p className="mx-auto mt-1.5 max-w-[250px] text-[13px] leading-relaxed text-white/60">
            {home("description")}
          </p>
        </div>
      </header>

      {/* ── Trust Badges — marquee ── */}
      <div className="overflow-hidden -mx-4" aria-hidden>
        <div className="flex w-max gap-2 animate-marquee">
          {[...TRUST_BADGES, ...TRUST_BADGES].map(({ label, Icon, accent }, i) => (
            <span
              key={i}
              className="shrink-0 flex items-center gap-1.5 rounded-full border-2 border-white/10 bg-white/5 px-3 py-1.5 font-mono text-[10px] text-white/70 backdrop-blur-sm"
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
          <div className="grid grid-cols-3 gap-2 rounded-2xl border-2 border-white/10 bg-white/5 p-4 backdrop-blur-sm">
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
            {home("create_room")}
          </span>
          <span
            aria-hidden
            className="absolute inset-0 bg-black/0 transition-colors duration-150 group-active:bg-black/10"
          />
        </Link>

        {/* Quick Match */}
        <QuickMatchButton />

        {/* Browse Rooms */}
        <Link
          href="/rooms"
          className="group cursor-pointer overflow-hidden rounded-2xl border-2 border-white/10 bg-white/5 py-5 text-center backdrop-blur-sm transition-all duration-200 active:scale-[0.97] hover:border-[#00C4B3]/40"
        >
          <span className="flex flex-col items-center gap-2">
            <Search className="h-5 w-5" style={{ color: "#00C4B3" }} />
            <span className="font-heading text-sm font-semibold text-white">{home("browse_rooms")}</span>
          </span>
        </Link>

        {/* Leaderboard */}
        <Link
          href="/leaderboard"
          className="group cursor-pointer overflow-hidden rounded-2xl border-2 border-white/10 bg-white/5 py-5 text-center backdrop-blur-sm transition-all duration-200 active:scale-[0.97] hover:border-[#FCFF52]/40"
        >
          <span className="flex flex-col items-center gap-2">
            <Medal className="h-5 w-5" style={{ color: "#FCFF52" }} />
            <span className="font-heading text-sm font-semibold text-white">{home("leaderboard")}</span>
          </span>
        </Link>

        {/* Weekly Tournament */}
        <Link
          href="/tournament"
          className="col-span-2 group relative cursor-pointer overflow-hidden rounded-2xl border-2 border-yellow-500/25 bg-gradient-to-r from-yellow-500/8 to-yellow-400/4 py-4 text-center backdrop-blur-sm transition-all duration-200 active:scale-[0.97] hover:border-yellow-500/40 hover:from-yellow-500/12 hover:to-yellow-400/8"
        >
          <span className="flex items-center justify-center gap-2">
            <Trophy className="h-4 w-4 text-yellow-400 transition-colors group-hover:text-yellow-300" />
            <span className="font-heading text-sm font-semibold text-white/75 transition-colors group-hover:text-white/90">
              {home("weekly_tournament")}
            </span>
            <span className="rounded-full border-2 border-yellow-500/30 bg-yellow-500/10 px-2 py-0.5 font-mono text-[10px] text-yellow-400">
              {home("prize_pool")}
            </span>
          </span>
        </Link>

        {/* Protocol Stats */}
        <Link
          href="/stats"
          className="col-span-2 group relative cursor-pointer overflow-hidden rounded-2xl border-2 border-[#FCFF52]/20 bg-gradient-to-r from-[#FCFF52]/5 to-[#00C4B3]/5 py-4 text-center backdrop-blur-sm transition-all duration-200 active:scale-[0.97] hover:border-[#FCFF52]/35 hover:from-[#FCFF52]/10 hover:to-[#00C4B3]/10"
        >
          <span className="flex items-center justify-center gap-2">
            <BarChart2 className="h-4 w-4 transition-colors" style={{ color: "#FCFF52" }} />
            <span className="font-heading text-sm font-semibold text-white/65 transition-colors group-hover:text-white/85">
              {home("protocol_stats")}
            </span>
            <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
          </span>
        </Link>
      </div>

      {/* ── How it works ── */}
      <section className="rounded-2xl border-2 border-white/10 bg-white/5 p-5 backdrop-blur-sm">
        <h2 className="mb-5 font-heading text-[10px] font-bold uppercase tracking-widest text-white/30">
          {home("how_it_works")}
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
        {common("footer")}
      </footer>
    </div>
  );
}
