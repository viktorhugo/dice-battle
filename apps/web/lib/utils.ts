export function truncateAddress(addr?: string): string {
  if (!addr || addr.length < 10) return addr ?? "";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export const NETWORK_LABEL: Record<string, string> = {
  celo: "Celo mainnet",
  celo_sepolia: "Celo Sepolia",
};
