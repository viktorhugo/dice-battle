import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { TOKENS } from "@/lib/constants"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function truncateAddress(address: string): string {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

const TOKEN_SYMBOL_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(TOKENS).map(([symbol, addr]) => [addr.toLowerCase(), symbol])
);

export function getTokenSymbol(tokenAddress: string): string {
  return TOKEN_SYMBOL_MAP[tokenAddress.toLowerCase()] ?? "???";
}

export const NETWORK_LABEL: Record<string, string> = {
  celo: "Celo Mainnet",
  celo_sepolia: "Celo Sepolia",
};

export function timeAgo(unixSeconds: number): string {
  const diff = Math.floor(Date.now() / 1000) - unixSeconds;
  if (diff < 5) return "just now";
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}
