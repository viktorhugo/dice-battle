"use client";

import { useCallback } from "react";
import confetti from "canvas-confetti";

const COLORS = ["#4a4a5a", "#666677", "#334455", "#888899", "#3d3d4d"];

export function useAshes() {
  return useCallback(() => {
    const origins = [0.2, 0.5, 0.8];

    origins.forEach((x, i) => {
      setTimeout(() => {
        confetti({
          particleCount: 55,
          startVelocity: 4,
          spread: 180,
          ticks: 220,
          zIndex: 9999,
          colors: COLORS,
          origin: { x, y: 0 },
          gravity: 2.2,
          scalar: 0.65,
          drift: 0,
          shapes: ["circle"],
        });
      }, i * 200);
    });
  }, []);
}
