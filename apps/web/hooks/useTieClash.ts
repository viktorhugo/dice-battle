"use client";

import { useCallback } from "react";
import confetti from "canvas-confetti";

const COLORS = ["#FFD700", "#C0C0C0", "#FFF8DC", "#E8E8E8", "#FFEC99"];

export function useTieClash() {
  return useCallback(() => {
    const shoot = (angle: number, x: number) => {
      confetti({
        particleCount: 55,
        angle,
        spread: 40,
        startVelocity: 38,
        ticks: 160,
        zIndex: 9999,
        colors: COLORS,
        origin: { x, y: 0.55 },
        gravity: 1.1,
        scalar: 0.8,
      });
    };

    // first clash
    shoot(60, 0);
    shoot(120, 1);

    // second burst slightly delayed
    setTimeout(() => {
      shoot(70, 0.05);
      shoot(110, 0.95);
    }, 180);
  }, []);
}
