"use client";

import { useMiniPay } from "@/hooks/useMiniPay";

function truncate(addr?: string) {
  if (!addr) return "";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function WalletBar() {
  const { isMiniPay, address, isConnected, checked } = useMiniPay();

  if (!checked) {
    return (
      <div className="flex items-center justify-between text-xs text-white/50">
        <span>Loading…</span>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between text-xs">
      <div className="flex items-center gap-2">
        {
          isMiniPay && (
            <span className="inline-flex items-center gap-1 rounded-full bg-minipay-teal/20 px-2 py-0.5 text-minipay-teal">
              <span className="h-1.5 w-1.5 rounded-full bg-minipay-teal" />
              MiniPay
            </span>
          )
        }
        {
          isConnected && address ? (
            <span className="font-mono text-white/70">{truncate(address)}</span>
          ) : (
            <span className="text-white/50">No wallet</span>
          )
        }
      </div>
      <span className="text-white/40">Celo mainnet</span>
    </div>
  );
}
