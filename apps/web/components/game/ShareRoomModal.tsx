"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Link as LinkIcon, MessageCircle, Send } from "lucide-react";
import { CELO_DARK } from "@/lib/theme";

interface Props {
  url: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ShareRoomModal({ url, open, onOpenChange }: Props) {
  const [copied, setCopied] = useState(false);
  const share = useTranslations("share");

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // WebView blocked clipboard — link still visible/selectable via QR
    }
  }

  const message = share("invite_message");
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(`${message} ${url}`)}`;
  const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(message)}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex flex-col gap-4 bg-[#1a1a1a] border-white/10">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold text-white">
            {share("title")}
          </DialogTitle>
          <DialogDescription className="text-white/50 text-xs">
            {share("description")}
          </DialogDescription>
        </DialogHeader>

        {/* QR code */}
        <div className="flex justify-center rounded-xl bg-white p-4">
          <QRCodeSVG value={url} size={160} bgColor="#ffffff" fgColor={CELO_DARK} level="M" />
        </div>

        {/* Deeplinks */}
        <div className="grid grid-cols-2 gap-2">
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 rounded-xl border border-green-500/30 bg-green-500/10 py-3 text-sm font-semibold text-green-400 active:opacity-70 transition-opacity"
          >
            <MessageCircle className="h-4 w-4" /> WhatsApp
          </a>
          <a
            href={telegramUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 rounded-xl border border-sky-500/30 bg-sky-500/10 py-3 text-sm font-semibold text-sky-400 active:opacity-70 transition-opacity"
          >
            <Send className="h-4 w-4" /> Telegram
          </a>
        </div>

        {/* Copy link */}
        <button
          type="button"
          onClick={handleCopy}
          className={`flex items-center justify-center gap-2 rounded-xl border py-3 text-sm font-semibold transition-colors active:opacity-70 ${
            copied
              ? "border-green-500/40 bg-green-500/10 text-green-400"
              : "border-white/10 bg-white/5 text-white/70"
          }`}
        >
          <LinkIcon className="h-4 w-4" />
          {copied ? share("copied") : share("copy_link")}
        </button>
      </DialogContent>
    </Dialog>
  );
}
