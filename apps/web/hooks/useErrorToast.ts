"use client";

import { useEffect, useState } from "react";
import { mapError } from "@/lib/errors";

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
    const mapped = mapError(raw);
    setErrorRaw(mapped.message);
  }

  return [error, setError] as const;
}
