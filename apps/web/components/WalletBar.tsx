"use client";

import Link from "next/link";
import { Wallet } from "lucide-react";
import { useAppKit } from "@reown/appkit/react";
import { useChainId, useSwitchChain } from "wagmi";
import { useMiniPay } from "@/hooks/useMiniPay";
import { Identicon } from "@/components/ui/identicon";
import { Skeleton } from "@/components/ui/skeleton";
import { CHAIN_ID, NETWORK } from "@/lib/constants";
import { NETWORK_LABEL, truncateAddress } from "@/lib/utils";

function ConnectButton({ address, isConnected }: { address?: string; isConnected: boolean }) {
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
        {isConnected && address ? truncateAddress(address) : "Enter Arena"}
      </span>
    </button>
  );
}

export function WalletBar() {
  const { isMiniPay, checked, address, isConnected } = useMiniPay();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();

  const isWrongNetwork = isConnected && checked && chainId !== CHAIN_ID;

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
            <ConnectButton address={address} isConnected={isConnected} />
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
        </div>
        <span className="text-white/40">{NETWORK_LABEL[NETWORK] ?? "Celo"}</span>
      </div>

      {isWrongNetwork && (
        <button
          type="button"
          onClick={() => switchChain({ chainId: CHAIN_ID })}
          className="w-full rounded-xl border border-orange-500/30 bg-orange-500/10 px-3 py-2 text-left text-xs text-orange-400 active:opacity-70"
        >
          ⚠️ Wrong network — tap to switch to {NETWORK_LABEL[NETWORK]}
        </button>
      )}
    </div>
  );
}
