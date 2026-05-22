"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

// Pip positions [cx, cy] in a 100×100 viewBox — standard die layout
const PIPS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[68, 32], [32, 68]],
  3: [[68, 32], [50, 50], [32, 68]],
  4: [[32, 32], [68, 32], [32, 68], [68, 68]],
  5: [[32, 32], [68, 32], [50, 50], [32, 68], [68, 68]],
  6: [[32, 28], [32, 50], [32, 72], [68, 28], [68, 50], [68, 72]],
};

const GHOST_PIPS = PIPS[6]; // all 6 positions

function GhostDieFace() {
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full">
      {GHOST_PIPS.map(([cx, cy], i) => (
        <circle
          key={i}
          cx={cx}
          cy={cy}
          r="8.5"
          fill="white"
          style={{
            animation: `ghostPip 2s ease-in-out ${i * 0.28}s infinite`,
          }}
        />
      ))}
    </svg>
  );
}

function DieFace({ value }: { value: number | "?" }) {
  if (value === "?") {
    return <GhostDieFace />;
  }

  return (
    <svg viewBox="0 0 100 100" className="h-full w-full">
      {(PIPS[value] ?? []).map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r="8.5" fill="white" />
      ))}
    </svg>
  );
}

function randomFace() {
  return Math.floor(Math.random() * 6) + 1;
}

export function DiceAnimation({ value, delay = 0 }: { value?: number; delay?: number }) {
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState<number | "?">("?");
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];

    if (value == null) {
      setDisplay("?");
      return;
    }

    if (reduce) {
      setDisplay(value);
      return;
    }

    const base = delay;

    // Phase 1: spin caótico (0–500ms) — cara random cada ~50ms
    let t = base;
    while (t < base + 500) {
      const captured = t;
      timersRef.current.push(setTimeout(() => setDisplay(randomFace()), captured));
      t += 50;
    }

    // Phase 2: slowdown (500–1200ms) — intervalos crecientes
    [500, 600, 700, 850, 1000, 1150].forEach((ms) => {
      timersRef.current.push(setTimeout(() => setDisplay(randomFace()), base + ms));
    });

    // Phase 3: valor final
    timersRef.current.push(setTimeout(() => setDisplay(value), base + 1200));

    return () => timersRef.current.forEach(clearTimeout);
  }, [value, delay, reduce]);

  const isRevealed = value != null && display === value;

  return (
    <motion.div
      key={isRevealed ? "final" : "spinning"}
      initial={isRevealed ? { scale: 1.25, rotate: 0 } : { scale: 1, rotate: 0 }}
      animate={{ scale: 1, rotate: 0 }}
      transition={
        isRevealed
          ? { type: "spring", stiffness: 400, damping: 12 }
          : { duration: 0 }
      }
      className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/15 bg-white/5"
    >
      <DieFace value={display} />
    </motion.div>
  );
}

export function DicePair({
  roll1,
  roll2,
  label,
  delay = 0,
}: {
  roll1?: number;
  roll2?: number;
  label: string;
  delay?: number;
}) {
  const reduce = useReducedMotion();
  const total = (roll1 ?? 0) + (roll2 ?? 0);
  const [displayTotal, setDisplayTotal] = useState(0);

  useEffect(() => {
    if (roll1 == null || roll2 == null) { setDisplayTotal(0); return; }
    if (reduce) { setDisplayTotal(total); return; }

    const start = delay + 1500;
    const duration = 500;
    const steps = 20;
    const timers: ReturnType<typeof setTimeout>[] = [];

    for (let i = 0; i <= steps; i++) {
      const captured = i;
      timers.push(
        setTimeout(
          () => setDisplayTotal(Math.round((captured / steps) * total)),
          start + (captured / steps) * duration
        )
      );
    }
    return () => timers.forEach(clearTimeout);
  }, [roll1, roll2, total, delay, reduce]);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex gap-2">
        <DiceAnimation value={roll1} delay={delay} />
        <DiceAnimation value={roll2} delay={delay} />
      </div>
      <span className="text-xs uppercase tracking-wider text-white/50">
        {label}
        {roll1 != null ? (
          <span className="ml-1 tabular-nums">({displayTotal})</span>
        ) : null}
      </span>
    </div>
  );
}
