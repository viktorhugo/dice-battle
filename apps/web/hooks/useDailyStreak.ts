"use client";

import { useEffect, useState } from "react";
import { recordVisit, getStreak, type DailyStreakData } from "@/lib/dailyStreak";

type StreakState = Pick<DailyStreakData, "streak" | "days">;

const DEFAULT: StreakState = { streak: 0, days: [] };

export function useDailyStreak(address?: string): StreakState {
  const [state, setState] = useState<StreakState>(DEFAULT);

  useEffect(() => {
    if (!address) return;
    const data = recordVisit(address);
    setState({ streak: data.streak, days: data.days });
  }, [address]);

  return state;
}

export function useStreakReadOnly(address?: string): StreakState {
  const [state, setState] = useState<StreakState>(DEFAULT);

  useEffect(() => {
    if (!address) return;
    const data = getStreak(address);
    setState({ streak: data.streak, days: data.days });
  }, [address]);

  return state;
}
