"use client";

import { useCallback, useEffect, useState } from "react";
import { isMuted, toggleMute, playDiceRoll, playWin, playLoss } from "@/lib/sounds";

function haptic(pattern: number | number[]): void {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(pattern);
    }
  } catch { /* ignore */ }
}

export function useSoundEngine() {
  const [muted, setMutedState] = useState(false);

  useEffect(() => {
    setMutedState(isMuted());
  }, []);

  const toggleSound = useCallback(() => {
    const next = toggleMute();
    setMutedState(next);
    return next;
  }, []);

  const diceRoll = useCallback(() => {
    playDiceRoll();
    haptic([30, 20, 30]);
  }, []);

  const winSound = useCallback(() => {
    playWin();
    haptic([100, 50, 100, 50, 200]);
  }, []);

  const lossSound = useCallback(() => {
    playLoss();
    haptic([300]);
  }, []);

  const tieSound = useCallback(() => {
    playDiceRoll();
    haptic([100]);
  }, []);

  return { muted, toggleSound, diceRoll, winSound, lossSound, tieSound };
}
