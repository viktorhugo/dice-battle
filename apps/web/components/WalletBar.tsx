"use client";

import Link from "next/link";
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
      className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/80 active:opacity-70"
    >
      {isConnected && address ? truncateAddress(address) : "Connect"}
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
