"use client";

import { useMemo } from "react";
import { minidenticon } from "minidenticons";

export function Identicon({
  address,
  size = 32,
  className = "",
}: {
  address: string;
  size?: number;
  className?: string;
}) {
  const svg = useMemo(
    () => minidenticon(address.toLowerCase(), 95, 45),
    [address]
  );
  return (
    <img
      src={`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`}
      alt=""
      width={size}
      height={size}
      className={`rounded-full bg-white/5 ${className}`}
    />
  );
}
