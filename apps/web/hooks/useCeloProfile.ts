"use client";

import { useState, useEffect } from "react";
import { resolveCeloProfile, type CeloProfile } from "@/lib/ens";

export function useCeloProfile(address?: string) {
  const [profile, setProfile] = useState<CeloProfile | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!address) { setProfile(null); return; }
    let cancelled = false;
    setLoading(true);
    resolveCeloProfile(address).then((p) => {
      if (!cancelled) { setProfile(p); setLoading(false); }
    });
    return () => { cancelled = true; };
  }, [address]);

  return { profile, loading };
}
