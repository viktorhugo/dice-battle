"use client";

import { useState, useEffect } from "react";
import { useNickname } from "@/hooks/useNickname";
import { resolveAddress } from "@/lib/ens";
import { truncateAddress } from "@/lib/utils";

/**
 * Returns a human-readable name for a wallet address.
 * Priority: on-chain Nickname → Celoname / ENS → truncated address.
 */
export function useDisplayName(address?: string): string {
  const { data: nickname } = useNickname(address);
  const [resolved, setResolved] = useState<string | null>(null);

  useEffect(() => {
    if (!address || nickname) {
      setResolved(null);
      return;
    }
    let cancelled = false;
    resolveAddress(address).then((name) => {
      if (!cancelled) setResolved(name);
    });
    return () => { cancelled = true; };
  }, [address, nickname]);

  if (nickname) return nickname;
  if (resolved) return resolved;
  return truncateAddress(address ?? "");
}
