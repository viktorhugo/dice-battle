"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { formatUnits } from "viem";
import { usePublicClient } from "wagmi";
import { WalletBar } from "@/components/WalletBar";
import { Skeleton } from "@/components/ui/skeleton";
import { GAME_ADDRESS, TOKENS, ERC20_ABI, NETWORK, getTokenDecimals } from "@/lib/constants";
import { getContractStats, type ContractStats } from "@/lib/indexer";
import { getTokenSymbol, getTokenIcon, truncateAddress, timeAgo } from "@/lib/utils";
import { logger } from "@/lib/logger";
import { Copy, ExternalLink, Check, ArrowBigLeftDash } from "lucide-react";
import { useTranslations } from "next-intl";

const EXPLORER_BASE =
  NETWORK === "celo" ? "https://celoscan.io" : "https://alfajores.celoscan.io";

type TokenBalance = {
  key: string;
  address: string;
  balance: bigint;
  decimals: number;
  icon: string;
};

type StatKey = "totalFinished" | "resolved" | "tied" | "open" | "matched" | "expired";

const STAT_ROWS: Array<{ key: StatKey; color: string }> = [
  { key: "totalFinished", color: "text-white" },
  { key: "resolved",      color: "text-green-400" },
  { key: "tied",          color: "text-yellow-400" },
  { key: "open",          color: "text-[#00C4B3]" },
  { key: "matched",       color: "text-[#FCFF52]" },
  { key: "expired",       color: "text-red-400" },
];

export default function StatsPage() {
  const publicClient = usePublicClient();
  const statsI18n = useTranslations("stats");
  const STAT_LABELS: Record<StatKey, string> = {
    totalFinished: statsI18n("total_finished"),
    resolved:      statsI18n("resolved"),
    tied:          statsI18n("tied_stat"),
    open:          statsI18n("open_now"),
    matched:       statsI18n("matched"),
    expired:       statsI18n("expired"),
  };
  const [stats, setStats] = useState<ContractStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [balances, setBalances] = useState<TokenBalance[]>([]);
  const [celoBalance, setCeloBalance] = useState<bigint | null>(null);
  const [balancesLoading, setBalancesLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    getContractStats()
      .then(setStats)
      .catch((e) => logger.error("[stats] indexer:", e))
      .finally(() => setStatsLoading(false));
  }, []);

  useEffect(() => {
    if (!publicClient) return;
    async function fetchBalances() {
      try {
        const tokenEntries = Object.entries(TOKENS) as [string, `0x${string}`][];
        const [nativeBalance, ...tokenResults] = await Promise.all([
          publicClient!.getBalance({ address: GAME_ADDRESS }),
          ...tokenEntries.map(([, addr]) =>
            publicClient!.readContract({
              address: addr,
              abi: ERC20_ABI,
              functionName: "balanceOf",
              args: [GAME_ADDRESS],
            }) as Promise<bigint>
          ),
        ]);
        setCeloBalance(nativeBalance);
        setBalances(
          tokenEntries.map(([key, addr], i) => ({
            key,
            address: addr,
            balance: tokenResults[i],
            decimals: getTokenDecimals(addr),
            icon: getTokenIcon(addr),
          }))
        );
      } catch (e) {
        logger.error("[stats] balances:", e);
      } finally {
        setBalancesLoading(false);
      }
    }
    fetchBalances();
  }, [publicClient]);

  function copyAddress() {
    navigator.clipboard.writeText(GAME_ADDRESS).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const tvl = balances.reduce(
    (sum, t) => sum + parseFloat(formatUnits(t.balance, t.decimals)),
    0
  );

  return (
    <div className="flex flex-col gap-5 pb-10">
      <WalletBar />

      <header className="flex items-center justify-between pt-2">
        <Link href="/" className="text-sm text-white/40 transition-colors hover:text-white/70 flex items-center gap-1">
          <ArrowBigLeftDash /> {statsI18n("back")}
        </Link>
        <h1 className="font-heading text-base font-semibold tracking-wide">{statsI18n("title")}</h1>
        <div className="w-10" />
      </header>

      {/* ── TVL / Portfolio badge ── */}
      <div className="relative overflow-hidden rounded-2xl border border-[#FCFF52]/20 bg-gradient-to-br from-[#FCFF52]/8 to-[#00C4B3]/5 p-4 backdrop-blur-sm">
        {/* Ambient glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full blur-3xl opacity-20"
          style={{ background: "#FCFF52" }}
        />
        <div className="relative flex items-center justify-between">
          <div className="flex flex-col gap-0.5">
            <p className="text-[13px] uppercase tracking-widest text-white/70 font-heading">
              {statsI18n("tvl")}
            </p>
            <p className="text-[10px] font-mono text-white/50">
              {statsI18n("stablecoins_only")}
            </p>
          </div>
          <div className="flex flex-col items-end gap-0.5">
            {balancesLoading ? (
              <Skeleton className="h-7 w-20" />
            ) : (
              <>
                <span className="font-mono text-2xl font-bold tabular-nums" style={{ color: "#FCFF52" }}>
                  ${tvl.toFixed(2)}
                </span>
                <span className="flex items-center gap-1 text-[10px] text-white/30 font-mono">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse inline-block" />
                  {statsI18n("live_onchain")}
                </span>
              </>
            )}
          </div>
        </div>

      </div>

      {/* ── Contract address ── */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
        <p className="mb-2 text-[11px] uppercase tracking-widest text-white/55 font-heading">
          {statsI18n("contract")}
        </p>
        <div className="flex items-center justify-between gap-2">
          <span className="break-all font-mono text-xs text-white/70">{GAME_ADDRESS}</span>
          <div className="flex shrink-0 items-center gap-1">
            <button
              onClick={copyAddress}
              aria-label="Copy address"
              className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-white/40 transition-colors hover:text-white/70 active:opacity-70"
            >
              {copied
                ? <Check className="h-3.5 w-3.5 text-green-400" />
                : <Copy className="h-3.5 w-3.5" />}
            </button>
            <a
              href={`${EXPLORER_BASE}/address/${GAME_ADDRESS}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="View on explorer"
              className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-white/40 transition-colors hover:text-white/70 active:opacity-70"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
        <p className="mt-2 font-mono text-[10px] text-amber-400">
          {NETWORK === "celo" ? statsI18n("celo_mainnet") : statsI18n("celo_testnet")}
        </p>
      </div>

      {/* ── Locked in contract (on-chain, live) ── */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
        <p className="mb-3 text-[11px] uppercase tracking-widest text-white/45 font-heading">
          {statsI18n("locked_in_contract")}
        </p>
        {balancesLoading ? (
          <div className="grid grid-cols-4 gap-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex flex-col items-center gap-1.5">
                <Skeleton className="h-5 w-5 rounded-full" />
                <Skeleton className="h-4 w-10" />
                <Skeleton className="h-2.5 w-8" />
              </div>
            ))}
          </div>
        ) : (
          <div className={`grid gap-2 ${balances.length + 1 <= 3 ? "grid-cols-3" : "grid-cols-4"}`}>
            {balances.map((t) => (
              <div
                key={t.key}
                className="flex flex-col items-center gap-1 rounded-xl border border-white/10 bg-white/5 px-2 py-2.5"
              >
                {t.icon && (
                  <Image src={t.icon} alt={t.key} width={20} height={20} className="rounded-full" />
                )}
                <span className="font-mono text-sm font-bold tabular-nums text-white">
                  {parseFloat(formatUnits(t.balance, t.decimals)).toFixed(2)}
                </span>
                <span className="text-[10px] text-white/35">{t.key}</span>
              </div>
            ))}
            {/* CELO native */}
            {celoBalance !== null && (
              <div className="flex flex-col items-center gap-1 rounded-xl border border-white/10 bg-white/5 px-2 py-2.5">
                <div
                  className="flex h-5 w-5 items-center justify-center rounded-full"
                  style={{ background: "rgba(252,255,82,0.15)" }}
                >
                  <span className="text-[9px] font-bold" style={{ color: "#FCFF52" }}>C</span>
                </div>
                <span className="font-mono text-sm font-bold tabular-nums text-white">
                  {parseFloat(formatUnits(celoBalance, 18)).toFixed(4)}
                </span>
                <span className="text-[10px] text-white/35">CELO</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── All-time stats (indexer) ── */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
        <p className="mb-3 text-[11px] uppercase tracking-widest text-white/45 font-heading">
          {statsI18n("all_time")}
        </p>
        {statsLoading ? (
          <div className="grid grid-cols-3 gap-2">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex flex-col gap-1.5 rounded-xl border border-white/10 bg-white/5 p-3">
                <Skeleton className="h-5 w-10" />
                <Skeleton className="h-2.5 w-14" />
              </div>
            ))}
          </div>
        ) : stats ? (
          <div className="grid grid-cols-3 gap-2">
            {STAT_ROWS.map(({ key, color }) => (
              <div
                key={key}
                className="flex flex-col gap-0.5 rounded-xl border border-white/10 bg-white/5 px-2.5 py-2"
              >
                <span className={`font-mono text-xl font-bold tabular-nums ${color}`}>
                  {stats[key]}
                </span>
                <span className="text-[9px] leading-tight text-white/30">{STAT_LABELS[key]}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-xs text-white/30">{statsI18n("could_not_load")}</p>
        )}
      </div>

      {/* ── Volume by token ── */}
      {!statsLoading && stats && Object.keys(stats.volumeByToken).length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
          <p className="mb-3 text-[11px] uppercase tracking-widest text-white/45 font-heading">
            {statsI18n("total_volume")}
          </p>
          <div className="flex flex-col gap-2">
            {Object.entries(stats.volumeByToken).map(([tokenAddr, amount]) => {
              const symbol = getTokenSymbol(tokenAddr);
              const decimals = getTokenDecimals(tokenAddr as `0x${string}`);
              const icon = getTokenIcon(tokenAddr);
              const formatted = parseFloat(formatUnits(amount, decimals)).toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              });
              return (
                <div
                  key={tokenAddr}
                  className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2.5"
                >
                  <div className="flex items-center gap-2">
                    {icon && (
                      <Image src={icon} alt={symbol} width={18} height={18} className="rounded-full" />
                    )}
                    <span className="font-mono text-xs text-white/50">{symbol}</span>
                  </div>
                  <span className="font-mono text-sm font-bold tabular-nums text-white">
                    {formatted}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Recent activity ── */}
      {!statsLoading && stats && stats.recentGames.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
          <p className="mb-3 text-[11px] uppercase tracking-widest text-white/45 font-heading">
            {statsI18n("recent_activity")}
          </p>
          <ul className="flex flex-col gap-1.5">
            {stats.recentGames.map((game) => {
              const symbol = getTokenSymbol(game.token);
              const decimals = getTokenDecimals(game.token as `0x${string}`);
              const icon = getTokenIcon(game.token);
              const isTie = game.state === "TIED";
              const stake = parseFloat(formatUnits(BigInt(game.stake), decimals)).toFixed(2);
              return (
                <li key={game.id}>
                  <Link
                    href={`/game/${game.id}`}
                    className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 transition-opacity active:opacity-70"
                  >
                    <span className="w-7 shrink-0 font-mono text-[9px] text-white/25">
                      #{game.id}
                    </span>
                    <div className="flex-1 min-w-0">
                      {isTie ? (
                        <span className="text-[11px] text-yellow-400">{statsI18n("tie")}</span>
                      ) : (
                        <span className="font-mono text-[11px] text-white/60 truncate">
                          {truncateAddress(game.winner ?? game.playerA)}
                        </span>
                      )}
                      <span className="ml-1.5 text-[11px] text-white/30">
                        {isTie ? statsI18n("refunded") : statsI18n("won")}
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {icon && (
                        <Image src={icon} alt={symbol} width={12} height={12} className="rounded-full" />
                      )}
                      <span className="font-mono text-[11px] text-white/50">{stake}</span>
                    </div>
                    <span className="shrink-0 text-[10px] text-white/25">
                      {game.resolvedAt ? timeAgo(Number(game.resolvedAt)) : ""}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
          <a
            href={`${EXPLORER_BASE}/address/${GAME_ADDRESS}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 flex items-center justify-center gap-1 text-[10px] text-white/25 transition-colors hover:text-white/50"
          >
            {statsI18n("view_all_celoscan")} <ExternalLink className="h-2.5 w-2.5" />
          </a>
        </div>
      )}
    </div>
  );
}
