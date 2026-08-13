"use client";

import { useState } from "react";
import { Tag, Loader2, Check, AlertCircle, Pencil } from "lucide-react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { useSetNickname } from "@/hooks/useSetNickname";
import { useTranslations } from "next-intl";

const MAX_LEN = 20;

interface Props {
  current?: string;
  open: boolean;
  onClose: () => void;
  onSaved: (name: string) => void;
}

export function NicknameEditModal({ current, open, onClose, onSaved }: Props) {
  const [name, setName] = useState(current ?? "");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const { setNickname, isPending } = useSetNickname();
  const nicknameModal = useTranslations("nicknameModal");

  function handleChange(v: string) {
    if (v.length <= MAX_LEN) {
      setName(v);
      setError("");
    }
  }

  async function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) { setError(nicknameModal("empty_error")); return; }
    try {
      const saved = await setNickname(trimmed);
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onSaved(saved);
        onClose();
      }, 900);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : nicknameModal("failed_save");
      setError(msg);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !isPending) onClose(); }}>
      <DialogContent className="bg-celo-dark border border-white/10 text-white max-w-xs mx-auto rounded-2xl p-0 overflow-hidden">

        {/* Header gradient strip */}
        <div className="relative h-14 bg-gradient-to-r from-celo-yellow/20 via-minipay-teal/15 to-celo-yellow/10 flex items-center px-5 gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-celo-yellow/20">
            <Tag className="h-4 w-4 text-celo-yellow" />
          </div>
          <div>
            <p className="text-sm font-bold text-white leading-none">{nicknameModal("title")}</p>
            <p className="text-[10px] text-white/40 mt-0.5">{nicknameModal("subtitle")}</p>
          </div>
          {/* decorative dots */}
          <span aria-hidden className="absolute right-4 top-3 h-1.5 w-1.5 rounded-full bg-celo-yellow/60 animate-ping" style={{ animationDuration: "2.4s" }} />
          <span aria-hidden className="absolute right-8 bottom-3 h-1 w-1 rounded-full bg-minipay-teal/50 animate-ping" style={{ animationDuration: "1.8s", animationDelay: "0.6s" }} />
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <div className="relative">
            <input
              value={name}
              onChange={(e) => handleChange(e.target.value)}
              placeholder={nicknameModal("placeholder")}
              maxLength={MAX_LEN}
              disabled={isPending}
              autoFocus
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-celo-yellow/50 focus:bg-celo-yellow/5 transition disabled:opacity-50 pr-14"
            />
            <span className={`absolute right-4 top-1/2 -translate-y-1/2 text-xs tabular-nums transition-colors ${name.length >= MAX_LEN ? "text-red-400" : "text-white/25"}`}>
              {name.length}/{MAX_LEN}
            </span>
          </div>

          {error && (
            <p className="text-xs text-red-400 flex items-center gap-1.5">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {error}
            </p>
          )}

          <div className="flex gap-2">
            <button
              onClick={onClose}
              disabled={isPending}
              className="flex-1 py-2.5 rounded-xl text-sm border border-white/10 text-white/50 hover:text-white hover:border-white/20 transition-all disabled:opacity-40"
            >
              {nicknameModal("cancel")}
            </button>
            <button
              onClick={handleSave}
              disabled={isPending || !name.trim()}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold text-celo-dark transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2 bg-gradient-to-br ${
                success ? "from-minipay-teal to-minipay-teal/80" : "from-celo-yellow to-[#e8eb3a]"
              }`}
            >
              {isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> {nicknameModal("saving")}</>
              ) : success ? (
                <><Check className="h-4 w-4" /> {nicknameModal("saved")}</>
              ) : (
                nicknameModal("save")
              )}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
