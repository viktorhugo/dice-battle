"use client";

import { http, createConfig } from "wagmi";
import { celo, celoSepolia } from "wagmi/chains";
import { injected } from "wagmi/connectors";

/**
 * wagmi config.
 *
 * We use the injected connector exclusively because inside MiniPay,
 * window.ethereum is provided and auto-connected. We never show
 * WalletConnect or other connectors to the user.
 *
 * CRITICAL: wagmi internally uses viem. Do NOT add ethers.js —
 * MiniPay does not support it.
 */
export const wagmiConfig = createConfig({
  chains: [celo, celoSepolia],
  connectors: [injected({ shimDisconnect: true })],
  transports: {
    [celo.id]: http(process.env.NEXT_PUBLIC_RPC_URL || "https://forno.celo.org"),
    [celoSepolia.id]: http("https://forno.celo-sepolia.celo-testnet.org"),
  },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
