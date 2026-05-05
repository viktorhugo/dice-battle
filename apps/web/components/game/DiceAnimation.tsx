"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

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

    // No animation — snap to value immediately
    if (reduce) {
      setDisplay(value);
      return;
    }

    const base = delay;

    // Phase 1: Spin caótico (0–500ms) — valores random cada ~50ms
    const phase1End = base + 500;
    let t = base;
    while (t < phase1End) {
      const captured = t;
      timersRef.current.push(setTimeout(() => setDisplay(randomFace()), captured));
      t += 50;
    }

    // Phase 2: Slowdown (500–1200ms) — cada 100ms, intervalos crecientes
    const slowSteps = [500, 600, 700, 850, 1000, 1150].map((ms) => base + ms);
    slowSteps.forEach((ms) => {
      timersRef.current.push(setTimeout(() => setDisplay(randomFace()), ms));
    });

    // Phase 3: Asentamiento — muestra el valor final (1200ms)
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
      className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/15 bg-white/5 text-3xl font-bold font-mono tabular-nums"
    >
      {display}
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

  // Phase 4: counter 0 → total (1500–2000ms after delay)
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
          <span className="ml-1 tabular-nums">
            ({displayTotal})
          </span>
        ) : null}
      </span>
    </div>
  );
}
