"use client";

import { useState } from "react";
import type { Hex } from "viem";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const shownKey = (roomId: string) => `dice-battle:secret-backup-shown:${roomId}`;

export function hasSeenBackup(roomId: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return !!window.localStorage.getItem(shownKey(roomId));
  } catch {
    return false;
  }
}

interface Props {
  roomId: string;
  secret: Hex;
  onDismiss: () => void;
}

export function SecretBackupModal({ roomId, secret, onDismiss }: Props) {
  const [copied, setCopied] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const secretBackup = useTranslations("secretBackup");

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
    } catch {
      // WebView blocked clipboard — secret visible for long-press copy
    }
  }

  function handleDismiss() {
    try {
      window.localStorage.setItem(shownKey(roomId), "1");
    } catch {
      // ignore
    }
    onDismiss();
  }

  const canDismiss = copied && confirmed;

  return (
    <Dialog open onOpenChange={() => { /* blocked — must confirm first */ }}>
      <DialogContent showCloseButton={false} className="flex flex-col gap-4 bg-[#1a1a1a] border-orange-500/30">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span className="text-lg">⚠️</span>
            <DialogTitle className="text-base font-semibold text-orange-400">
              {secretBackup("title")}
            </DialogTitle>
          </div>
          <DialogDescription className="text-white/50 text-xs leading-relaxed">
            {secretBackup.rich("description", {
              onDevice: (chunks) => <span className="text-white/70 font-medium">{chunks}</span>,
              cannotReveal: (chunks) => <span className="text-orange-400 font-medium">{chunks}</span>,
            })}
          </DialogDescription>
        </DialogHeader>

        {/* Secret box */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <p className="break-all font-mono text-[11px] leading-relaxed text-white/70 select-all">
            {secret}
          </p>
        </div>

        {/* Copy button */}
        <button
          type="button"
          onClick={handleCopy}
          className={`rounded-xl border py-3 text-sm font-semibold transition-colors active:opacity-70 ${
            copied
              ? "border-green-500/40 bg-green-500/10 text-green-400"
              : "border-[#FCFF52]/40 bg-[#FCFF52]/10 text-[#FCFF52]"
          }`}
        >
          {copied ? secretBackup("copied") : secretBackup("copy_secret")}
        </button>

        {/* Confirmation checkbox */}
        <label className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-colors ${confirmed ? "border-green-500/30 bg-green-500/5" : "border-white/10 bg-white/5"}`}>
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-green-400"
          />
          <span className="text-xs leading-relaxed text-white/60">
            {secretBackup("confirmation")}
          </span>
        </label>

        {/* Dismiss — only enabled after copy + confirm */}
        <button
          type="button"
          disabled={!canDismiss}
          onClick={handleDismiss}
          className="rounded-xl py-3 text-sm font-semibold transition-colors disabled:opacity-30 disabled:pointer-events-none"
          style={{ background: canDismiss ? "#FCFF52" : undefined, color: canDismiss ? "#0C0C0C" : undefined, border: canDismiss ? undefined : "1px solid rgba(255,255,255,0.1)" }}
        >
          {canDismiss ? secretBackup("got_it") : secretBackup("copy_confirm")}
        </button>
      </DialogContent>
    </Dialog>
  );
}
