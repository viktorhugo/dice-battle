"use client";

import dynamic from "next/dynamic";

// ssr:false solo es válido dentro de un Client Component — este wrapper existe
// únicamente para que layout.tsx (Server Component) pueda cargarlo diferido.
export const NotInMiniPayBannerLazy = dynamic(
  () => import("@/components/NotInMiniPayBanner").then((m) => ({ default: m.NotInMiniPayBanner })),
  { ssr: false }
);
