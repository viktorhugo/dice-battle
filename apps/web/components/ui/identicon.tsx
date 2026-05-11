"use client";

import { useEffect, useState } from "react";

export function Identicon({
  address,
  size = 32,
  className = "",
}: {
  address: string;
  size?: number;
  className?: string;
}) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    import("minidenticons").then(({ minidenticon }) => {
      const svg = minidenticon(address.toLowerCase(), 95, 45);
      setSrc(`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`);
    });
  }, [address]);

  if (!src) {
    return (
      <span
        style={{ width: size, height: size }}
        className={`inline-block rounded-full bg-white/5 ${className}`}
      />
    );
  }

  return (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      className={`rounded-full bg-white/5 ${className}`}
    />
  );
}
