export type UserErrorType =
  | "USER_CANCELLED"
  | "INSUFFICIENT_FUNDS"
  | "NETWORK_ERROR"
  | "TX_REVERTED"
  | "UNKNOWN";

export type UserError = {
  type: UserErrorType;
  message: string;
  rechargeDeeplink?: boolean;
};

export function mapError(err: unknown): UserError {
  const e = err as Error & { code?: number; cause?: { code?: number }; name?: string };
  const code = e?.code ?? (e?.cause as { code?: number } | undefined)?.code;
  const msg = (e?.message ?? "").toLowerCase();

  // User rejected the transaction (EIP-1193 code 4001, or MetaMask/MiniPay variants)
  if (
    code === 4001 ||
    code === -32604 ||
    e?.name === "UserRejectedRequestError" ||
    msg.includes("user denied") ||
    msg.includes("user rejected") ||
    msg.includes("rejected the request")
  ) {
    return { type: "USER_CANCELLED", message: "Transacción cancelada." };
  }

  // Insufficient funds
  if (
    code === -32000 ||
    msg.includes("insufficient funds") ||
    msg.includes("insufficient balance")
  ) {
    return { type: "INSUFFICIENT_FUNDS", message: "Saldo insuficiente.", rechargeDeeplink: true };
  }

  // Smart contract revert
  if (msg.includes("execution reverted") || msg.includes("transaction reverted")) {
    const raw = e?.message ?? "";
    const match =
      raw.match(/reason:\s*(.+?)(?:\n|$)/i) ??
      raw.match(/reverted with reason string '(.+?)'/i);
    return {
      type: "TX_REVERTED",
      message: match ? `Revertido: ${match[1]}` : "Transacción revertida.",
    };
  }

  // Network / RPC errors
  if (
    msg.includes("network") ||
    msg.includes("could not fetch") ||
    msg.includes("fetch failed") ||
    msg.includes("connection") ||
    msg.includes("timeout")
  ) {
    return { type: "NETWORK_ERROR", message: "Error de red. Verifica tu conexión." };
  }

  return { type: "UNKNOWN", message: "Algo salió mal. Intenta de nuevo." };
}
