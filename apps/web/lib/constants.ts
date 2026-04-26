import type { Address } from "viem";

export const NETWORK = (process.env.NEXT_PUBLIC_NETWORK || "celo") as "celo" | "celo_sepolia";

// Token addresses per network.
// Dev  → NEXT_PUBLIC_NETWORK=celo_sepolia  (Celo Sepolia testnet)
// Prod → NEXT_PUBLIC_NETWORK=celo          (Celo mainnet)
const TOKENS_MAINNET = {
  cUSD: "0x765DE816845861e75A25fCA122bb6898B8B1282a" as Address,
  USDT: "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e" as Address,
  USDC: "0xcebA9300f2b948710d2653dD7B07f33A8B32118C" as Address,
} as const;

const TOKENS_SEPOLIA = {
  cUSD: "0xdE9e4C3ce781b4bA68120d6261cbad65ce0aB00b" as Address,
  USDT: "0xd077A400968890Eacc75cdc901F0356c943e4fDb" as Address,
  USDC: "0x01C5C0122039549AD1493B8220cABEdD739BC44E" as Address,
  CELO: "0x4200000000000000000000000000000000000011" as Address,
} as const;

export const TOKENS = NETWORK === "celo_sepolia" ? TOKENS_SEPOLIA : TOKENS_MAINNET;
export type TokenKey = keyof typeof TOKENS_MAINNET | keyof typeof TOKENS_SEPOLIA;
export const TOKEN_KEYS = Object.keys(TOKENS) as TokenKey[];

export function getTokenAddress(key: TokenKey): Address {
  return (TOKENS as Record<TokenKey, Address>)[key];
}

export const GAME_ADDRESS = (process.env.NEXT_PUBLIC_GAME_ADDRESS ||
  "0x0000000000000000000000000000000000000000") as Address;

export const GAME_DEPLOY_BLOCK: bigint =
  NETWORK === "celo_sepolia"
    ? 23_860_807n
    : BigInt(process.env.NEXT_PUBLIC_GAME_DEPLOY_BLOCK || "0");

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
