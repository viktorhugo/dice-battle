"use client";

import { useCallback } from "react";
import confetti from "canvas-confetti";

const COLORS = ["#FCFF52", "#ffffff", "#FFD700", "#FFA500"];

function rand(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

export function useFireworks() {
  return useCallback(() => {
    const duration = 2800;
    const end = Date.now() + duration;

    const burst = () => {
      confetti({
        particleCount: 45,
        startVelocity: 30,
        spread: 360,
        ticks: 80,
        zIndex: 9999,
        colors: COLORS,
        origin: { x: rand(0.2, 0.8), y: rand(0.05, 0.45) },
        scalar: 0.95,
        gravity: 0.8,
      });
    };

    burst();
    const id = setInterval(() => {
      if (Date.now() >= end) {
        clearInterval(id);
        return;
      }
      burst();
    }, 380);
  }, []);
}
