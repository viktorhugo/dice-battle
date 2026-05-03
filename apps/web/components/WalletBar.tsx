"use client";

import { AppKitButton } from "@reown/appkit/react";
import { useMiniPay } from "@/hooks/useMiniPay";
import { Skeleton } from "@/components/ui/skeleton";
import { NETWORK } from "@/lib/constants";
import { NETWORK_LABEL } from "@/lib/utils";

export function WalletBar() {
  const { isMiniPay, checked } = useMiniPay();

  return (
    <div className="flex items-center justify-between text-xs">
      <div className="flex items-center gap-2">
        {!checked && <Skeleton className="h-8 w-28 rounded-xl" />}

        {checked && isMiniPay && (
          <span className="inline-flex items-center gap-1 rounded-full bg-minipay-teal/20 px-2 py-0.5 text-minipay-teal">
            <span className="h-1.5 w-1.5 rounded-full bg-minipay-teal" />
            MiniPay
          </span>
        )}

        {checked && !isMiniPay && <AppKitButton />}
      </div>
      <span className="text-white/40">{NETWORK_LABEL[NETWORK] ?? "Celo"}</span>
    </div>
  );
}
