"use client";

import { AppKitButton } from "@reown/appkit/react";
import { useMiniPay } from "@/hooks/useMiniPay";
import { NETWORK } from "@/lib/constants";
import { NETWORK_LABEL } from "@/lib/utils";

export function WalletBar() {
  const { isMiniPay, hasInjected, isConnected, checked } = useMiniPay();

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
          hasInjected && !isMiniPay && !isConnected && (
            <span className="inline-flex items-center gap-1 rounded-full bg-minipay-teal/20 px-2 py-0.5 text-minipay-teal">
              <span className="h-1.5 w-1.5 rounded-full bg-minipay-teal" />
              MiniPay
            </span>
          )
        }
        <AppKitButton />
      </div>
      <span className="text-white/40">{NETWORK_LABEL[NETWORK] ?? "Celo"}</span>
    </div>
  );
}
