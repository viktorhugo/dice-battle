"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Zap, Loader2 } from "lucide-react";
import { useConnection } from "wagmi";
import { useTranslations } from "next-intl";
import { getOpenRoomsPage } from "@/lib/indexer";

export function QuickMatchButton() {
  const router = useRouter();
  const { address } = useConnection();
  const home = useTranslations("home");
  const [state, setState] = useState<"idle" | "searching" | "none">("idle");

  async function handleClick() {
    if (state !== "idle") return;
    setState("searching");
    try {
      const { rooms } = await getOpenRoomsPage(1, 1, address ?? undefined);
      if (rooms.length === 0) {
        setState("none");
        setTimeout(() => setState("idle"), 2000);
        return;
      }
      router.push(`/join/${rooms[0].id}`);
    } catch {
      setState("none");
      setTimeout(() => setState("idle"), 2000);
    }
  }

  const isNone = state === "none";
  const isSearching = state === "searching";

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isSearching}
      className="col-span-2 group relative cursor-pointer overflow-hidden rounded-2xl border-2 py-[18px] text-center transition-transform duration-150 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-60"
      style={{
        borderColor: isNone ? "rgba(239,68,68,0.4)" : "#00C4B3",
        background: isNone ? "rgba(239,68,68,0.08)" : "rgba(0,196,179,0.1)",
        color: isNone ? "#f87171" : "#00C4B3",
      }}
    >
      <span className="relative z-10 flex items-center justify-center gap-2 font-heading text-[15px] font-semibold">
        {isSearching ? (
          <><Loader2 className="h-5 w-5 animate-spin" />{home("quick_match_searching")}</>
        ) : isNone ? (
          home("quick_match_none")
        ) : (
          <><Zap className="h-5 w-5" />{home("quick_match")}</>
        )}
      </span>
      <span
        aria-hidden
        className="absolute inset-0 bg-black/0 transition-colors duration-150 group-active:bg-black/10"
      />
    </button>
  );
}
