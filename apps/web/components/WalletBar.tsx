"use client";

import Link from "next/link";
import { Wallet, Volume2, VolumeX } from "lucide-react";
import { useAppKit } from "@reown/appkit/react";
import { useChainId, useSwitchChain } from "wagmi";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useMiniPay } from "@/hooks/useMiniPay";
import { useDailyStreak } from "@/hooks/useDailyStreak";
import { useSoundEngine } from "@/hooks/useSoundEngine";
import { Identicon } from "@/components/ui/identicon";
import { Skeleton } from "@/components/ui/skeleton";
import { CHAIN_ID, NETWORK } from "@/lib/constants";
import { NETWORK_LABEL } from "@/lib/utils";
import { useDisplayName } from "@/hooks/useDisplayName";
import { setLocaleCookie } from "@/app/actions/locale";

function ConnectButton({
  address,
  isConnected,
  displayName,
  enterArenaLabel,
}: {
  address?: string;
  isConnected: boolean;
  displayName: string;
  enterArenaLabel: string;
}) {
  const { open } = useAppKit();
  return (
    <button
      type="button"
      onClick={() => open()}
      className="relative overflow-hidden flex items-center gap-1.5 rounded-[11px] border border-[#FCFF52]/60 bg-[#0C0C0C] px-4 py-2 font-heading text-xs font-bold text-[#FCFF52] "
    >
      {/* partículas */}
      <span aria-hidden className="absolute left-3 top-1 h-[3px] w-[3px] rounded-full bg-[#FCFF52] opacity-70 animate-ping" style={{ animationDelay: "0s", animationDuration: "2s" }} />
      <span aria-hidden className="absolute bottom-1.5 right-5 h-[3px] w-[3px] rounded-full bg-[#FCFF52] opacity-50 animate-ping" style={{ animationDelay: "0.9s", animationDuration: "2.6s" }} />
      <span aria-hidden className="absolute right-3 top-2 h-[2px] w-[2px] rounded-full bg-white opacity-40 animate-ping" style={{ animationDelay: "1.5s", animationDuration: "1.9s" }} />

      <Wallet className="relative z-10 h-3.5 w-3.5 shrink-0" />
      <span className="relative z-10">
        {isConnected && address ? displayName : enterArenaLabel}
      </span>
    </button>
  );
}

export function WalletBar() {
  const { isMiniPay, checked, address, isConnected } = useMiniPay();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const displayName = useDisplayName(address);
  const locale = useLocale();
  const walletbar = useTranslations("walletbar");
  const router = useRouter();
  const { streak } = useDailyStreak(address);
  const { muted, toggleSound } = useSoundEngine();

  const isWrongNetwork = isConnected && checked && chainId !== CHAIN_ID;
  const networkLabel = NETWORK_LABEL[NETWORK] ?? "Celo";

  async function toggleLocale() {
    await setLocaleCookie(locale === "es" ? "en" : "es");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          {!checked && <Skeleton className="h-8 w-28 rounded-xl" />}

          {checked && isMiniPay && (
            <span className="inline-flex items-center gap-1 rounded-full bg-minipay-teal/20 px-2 py-0.5 text-minipay-teal">
              <span className="h-1.5 w-1.5 rounded-full bg-minipay-teal" />
              MiniPay
            </span>
          )}

          {checked && !isMiniPay && (
            <ConnectButton
              address={address}
              isConnected={isConnected}
              displayName={displayName}
              enterArenaLabel={walletbar("enter_arena")}
            />
          )}

          {checked && isConnected && address && (
            <Link
              href={`/profile/${address}`}
              className="rounded-full ring-2 ring-transparent transition-all active:opacity-70 hover:ring-white/20"
              aria-label="My profile"
            >
              <Identicon address={address} size={28} />
            </Link>
          )}

          {checked && isConnected && streak > 1 && (
            <span className="inline-flex items-center gap-1 rounded-full border border-orange-500/30 bg-orange-500/10 px-2 py-0.5 font-mono text-[10px] text-orange-400">
              🔥 {streak}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleSound}
            title={muted ? walletbar("unmute") : walletbar("mute")}
            className="rounded-md border border-white/10 p-1 text-white/40 hover:border-white/25 hover:text-white/70 transition-colors"
          >
            {muted
              ? <VolumeX className="h-3 w-3" />
              : <Volume2 className="h-3 w-3" />
            }
          </button>
          <button
            type="button"
            onClick={toggleLocale}
            className="rounded-md border border-white/10 px-1.5 py-0.5 font-mono text-[10px] text-white/40 hover:border-white/25 hover:text-white/70 transition-colors"
          >
            {locale === "es" ? "EN" : "ES"}
          </button>
          <span className="text-white/40">{networkLabel}</span>
        </div>
      </div>

      {isWrongNetwork && (
        <button
          type="button"
          onClick={() => switchChain({ chainId: CHAIN_ID })}
          className="w-full rounded-xl border border-orange-500/30 bg-orange-500/10 px-3 py-2 text-left text-xs text-orange-400 active:opacity-70"
        >
          {walletbar("wrong_network", { network: networkLabel })}
        </button>
      )}
    </div>
  );
}
