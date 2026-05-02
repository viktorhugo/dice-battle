"use client";

import { useEffect, useState } from "react";
import { useConnection, useConnect } from "wagmi";
import { injected } from "wagmi/connectors";
import { logger } from "@/lib/logger";

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
  const [hasInjected, setHasInjected] = useState(false);
  const [checked, setChecked] = useState(false);
  const { address, isConnected, status } = useConnection();
  const { mutate: connect } = useConnect();

  useEffect(() => {
    if (typeof window === "undefined") return;

    const eth = (window as unknown as {
      ethereum?: { isMiniPay?: boolean };
    }).ethereum;

    const inMiniPay = Boolean(eth?.isMiniPay);
    setIsMiniPay(inMiniPay);
    setChecked(true);
    setHasInjected(Boolean(eth));

    logger.log("[useMiniPay] ethereum:", Boolean(eth), "| isMiniPay:", inMiniPay, "| status:", status, "| address:", address);

    // Auto-connect inside MiniPay only when truly disconnected.
    // Avoid calling connect() during 'reconnecting' or 'connecting' —
    // that would interrupt wagmi's own reconnect flow and cause a loop.
    if (inMiniPay && status === "disconnected") {
      logger.log("[useMiniPay] Iniciando auto-connect...");
      connect({ connector: injected() });
    } else {
      logger.log("[useMiniPay] Auto-connect omitido — status:", status);
    }
  }, [connect, status]);

  return {
    isMiniPay,
    hasInjected,
    address,
    isConnected,
    checked,
  };
}
