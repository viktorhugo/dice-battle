"use client";

import { useState } from "react";
import { useMiniPay } from "@/hooks/useMiniPay";

// Overlay fijo en la parte inferior — position:fixed no causa CLS
export function NotInMiniPayBanner() {
  const { isMiniPay, isConnected, checked } = useMiniPay();
  const [dismissed, setDismissed] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!checked || isMiniPay || isConnected || dismissed) return null;

  async function copyUrl() {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div
      role="banner"
      className="fixed bottom-4 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-2xl border border-celo-yellow/20 bg-celo-dark/95 p-4 shadow-2xl backdrop-blur-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <p className="font-heading text-sm font-bold text-white">
            🎲 Abrir en MiniPay
          </p>
          <p className="mt-0.5 text-xs text-white/50 leading-relaxed">
            Esta app corre dentro de Opera Mini + MiniPay.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={copyUrl}
              className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70 hover:bg-white/10 transition-colors"
            >
              {copied ? "✓ Copiado" : "Copiar enlace"}
            </button>
            <a
              href="https://www.opera.com/es/mini"
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 rounded-xl bg-celo-yellow px-3 py-2 text-xs font-bold text-celo-dark text-center hover:bg-celo-yellow/90 transition-colors"
            >
              Descargar MiniPay
            </a>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Cerrar"
          className="shrink-0 rounded-full p-1 text-white/30 hover:text-white/60 transition-colors"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
