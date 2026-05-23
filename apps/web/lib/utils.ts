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

export function getTokenIcon(tokenAddress: string): string {
  const symbol = getTokenSymbol(tokenAddress);
  if (symbol === "USDC") return "/tokens/usdc.svg";
  if (symbol === "USDT") return "/tokens/usdt.svg";
  if (symbol === "USDm") return "/tokens/usdm.svg";
  return "/tokens/usdm.svg";
}

export function getTokenColor(tokenAddress: string): string {
  const symbol = getTokenSymbol(tokenAddress);
  if (symbol === "USDC") return "#2775CA";
  if (symbol === "USDT") return "#279797";
  if (symbol === "USDm") return "#5118C1";
  return "#FCFF52";
}

export const NETWORK_LABEL: Record<string, string> = {
  celo: "Celo Mainnet",
  celo_sepolia: "Celo Sepolia",
};

export function formatDate(unixSeconds: number): string {
  const d = new Date(unixSeconds * 1000);
  return d.toLocaleString(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function timeAgo(unixSeconds: number): string {
  const diff = Math.floor(Date.now() / 1000) - unixSeconds;
  if (diff < 5) return "just now";
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}
