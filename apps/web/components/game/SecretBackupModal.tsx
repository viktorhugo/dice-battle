"use client";

import { useEffect, useState } from "react";
import type { Hex } from "viem";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const AUTO_DISMISS_SECS = 10;
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
  const [secs, setSecs] = useState(AUTO_DISMISS_SECS);

  useEffect(() => {
    try {
      window.localStorage.setItem(shownKey(roomId), "1");
    } catch {
      // ignore (Safari private mode, etc.)
    }
  }, [roomId]);

  useEffect(() => {
    const interval = setInterval(() => {
      setSecs((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (secs === 0) onDismiss();
  }, [secs, onDismiss]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // WebView blocked clipboard access — secret is visible for long-press copy
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onDismiss(); }}>
      <DialogContent showCloseButton={false} className="flex flex-col gap-4 bg-[#1a1a1a] border-gray-500/40" >
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-base font-semibold text-white/80">Save your secret</DialogTitle>
            <span className="text-xs text-white/30">{secs}s</span>
          </div>
          <DialogDescription>
            Save this in case you lose access. Without it you can&apos;t reveal.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <p className="break-all font-mono text-[11px] leading-relaxed text-white/80">
            {secret}
          </p>
        </div>

        <button
          type="button"
          onClick={handleCopy}
          className={`rounded-xl border py-2.5 text-sm font-medium transition-colors active:opacity-70 ${
            copied
              ? "border-green-500/40 bg-green-500/10 text-green-400"
              : "border-white/15 text-white"
          }`}
        >
          {copied ? "✓ Copied!" : "Copy secret"}
        </button>

        <button
          type="button"
          onClick={onDismiss}
          className="text-center text-xs text-white/30 active:text-white/60"
        >
          Dismiss ({secs}s)
        </button>
      </DialogContent>
    </Dialog>
  );
}
