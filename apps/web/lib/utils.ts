import { TOKENS } from "./constants";

export function truncateAddress(addr?: string): string {
  if (!addr || addr.length < 10) return addr ?? "";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function getTokenSymbol(token: string): string {
  const lower = token.toLowerCase();
  for (const [key, addr] of Object.entries(TOKENS)) {
    if (addr.toLowerCase() === lower) return key;
  }
  return "UNKNOWN";
}

export const NETWORK_LABEL: Record<string, string> = {
  celo: "Celo mainnet",
  celo_sepolia: "Celo Sepolia",
};
