import type { Address } from "viem";

/**
 * Celo mainnet stablecoin addresses.
 * Source: https://docs.celo.org/build/build-on-minipay/overview
 */
export const TOKENS = {
  cUSD: "0x765DE816845861e75A25fCA122bb6898B8B1282a" as Address,
  USDT: "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e" as Address,
  USDC: "0xcebA9300f2b948710d2653dD7B07f33A8B32118C" as Address,
} as const;

export const GAME_ADDRESS = (process.env.NEXT_PUBLIC_GAME_ADDRESS ||
  "0x0000000000000000000000000000000000000000") as Address;

export const NETWORK = (process.env.NEXT_PUBLIC_NETWORK || "celo") as "celo" | "celo_sepolia";

export const CHAIN_ID = NETWORK === "celo" ? 42_220 : 11_142_220;

// Minimal ERC20 ABI for approve/allowance/balanceOf
export const ERC20_ABI = [
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "decimals",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint8" }],
  },
] as const;
