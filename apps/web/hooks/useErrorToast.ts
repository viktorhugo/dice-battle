"use client";

import { useEffect, useState } from "react";

function sanitize(raw: string): string {
  const msg = raw.toLowerCase();

  if (msg.includes("user denied") || msg.includes("user rejected") || msg.includes("rejected the request"))
    return "Transaction cancelled.";

  if (msg.includes("insufficient funds") || msg.includes("insufficient balance"))
    return "Insufficient balance.";

  if (msg.includes("execution reverted")) {
    const match = raw.match(/reason:\s*(.+?)(?:\n|$)/i) ?? raw.match(/reverted with reason string '(.+?)'/i);
    return match ? `Reverted: ${match[1]}` : "Transaction reverted.";
  }

  if (msg.includes("transaction reverted"))
    return "Transaction reverted.";

  if (msg.includes("network") || msg.includes("could not fetch"))
    return "Network error. Check your connection.";

  return "Something went wrong. Try again.";
}

export function useErrorToast(durationMs = 5000) {
  const [error, setErrorRaw] = useState<string | null>(null);

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setErrorRaw(null), durationMs);
    return () => clearTimeout(t);
  }, [error, durationMs]);

  function setError(raw: unknown) {
    if (typeof raw === "string") {
      setErrorRaw(raw);
      return;
    }
    const msg = raw instanceof Error ? raw.message : String(raw ?? "");
    setErrorRaw(sanitize(msg));
  }

  return [error, setError] as const;
}
