"use client";

import { useState } from "react";
import { useMiniPay } from "@/hooks/useMiniPay";

export function NotInMiniPayBanner() {
  const { isMiniPay, isConnected, checked } = useMiniPay();
  const [copied, setCopied] = useState(false);

  // Only show after hydration, when confirmed not in MiniPay and not connected
  if (!checked || isMiniPay || isConnected) return null;

  async function copyUrl() {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="mb-6 rounded-2xl border border-[#FCFF52]/20 bg-[#FCFF52]/5 p-5 text-center">
      <div className="text-3xl mb-3">🎲</div>
      <h2 className="font-heading text-sm font-bold text-white mb-1">
        Esta app está diseñada para MiniPay
      </h2>
      <p className="text-xs text-white/50 mb-4 leading-relaxed">
        Dice Battle corre en la wallet MiniPay dentro de Opera Mini.
        Abre este enlace desde MiniPay para jugar.
      </p>

      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={copyUrl}
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs text-white/70 hover:bg-white/10 transition-colors"
        >
          {copied ? "✓ Enlace copiado" : "Copiar enlace"}
        </button>
        <a
          href="https://www.opera.com/es/mini"
          target="_blank"
          rel="noopener noreferrer"
          className="w-full rounded-xl bg-[#FCFF52] px-4 py-2.5 text-xs font-bold text-[#0C0C0C] text-center block hover:bg-[#FCFF52]/90 transition-colors"
        >
          Descargar Opera Mini + MiniPay
        </a>
      </div>

      <p className="mt-3 text-[10px] text-white/25 leading-relaxed">
        Opera Mini → tab MiniPay → pega el enlace en el navegador
      </p>
    </div>
  );
}
