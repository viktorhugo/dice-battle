"use client";

import { useEffect, useState } from "react";
import { useAccount, useConnect } from "wagmi";
import { injected } from "wagmi/connectors";

/**
 * Detects if the dApp is running inside MiniPay.
 *
 * MiniPay injects `window.ethereum.isMiniPay = true` and handles wallet
 * connection implicitly. When detected, we auto-connect and hide any
 * "Connect Wallet" UI.
 *
 * Reference: https://docs.celo.org/build/build-on-minipay/overview
 */
export function useMiniPay() {
  const [isMiniPay, setIsMiniPay] = useState(false);
  const [checked, setChecked] = useState(false);
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();

  useEffect(() => {
    if (typeof window === "undefined") return;

    const eth = (window as unknown as {
      ethereum?: { isMiniPay?: boolean };
    }).ethereum;

    const inMiniPay = Boolean(eth?.isMiniPay);
    setIsMiniPay(inMiniPay);
    setChecked(true);

    // Auto-connect inside MiniPay — no wallet UI needed
    if (inMiniPay && !isConnected) {
      connect({ connector: injected() });
    }
  }, [connect, isConnected]);

  return {
    isMiniPay,
    address,
    isConnected,
    checked,
  };
}
