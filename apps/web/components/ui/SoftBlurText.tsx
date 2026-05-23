"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";

export function SoftBlurText({
  text,
  className,
  loop = false,
  loopInterval = 2500,
}: {
  text: string;
  className?: string;
  loop?: boolean;
  loopInterval?: number;
}) {
  const [cycle, setCycle] = useState(0);

  useEffect(() => {
    if (!loop) return;
    const id = setInterval(() => setCycle((c) => c + 1), loopInterval);
    return () => clearInterval(id);
  }, [loop, loopInterval]);

  return (
    <span className={className} aria-label={text}>
      {text.split("").map((char, i) => (
        <motion.span
          key={`${cycle}-${i}`}
          initial={{ opacity: 0, y: 16, filter: "blur(6px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.9, delay: i * 0.015, ease: [0.22, 1, 0.36, 1] }}
          style={{ display: "inline-block", whiteSpace: "pre" }}
        >
          {char}
        </motion.span>
      ))}
    </span>
  );
}
