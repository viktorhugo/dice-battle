import Link from "next/link";

export function AppFooter() {
  return (
    <footer className="mt-8 border-t border-white/5 pt-4 pb-2">
      <div className="flex flex-col items-center gap-2 text-center">
        <nav className="flex items-center gap-4 text-[11px] text-white/35">
          <Link href="/legal/terms" className="hover:text-white/60 transition-colors">
            Términos de Uso
          </Link>
          <span className="text-white/15">·</span>
          <Link href="/legal/privacy" className="hover:text-white/60 transition-colors">
            Privacidad
          </Link>
          <span className="text-white/15">·</span>
          <a
            href="https://t.me/dicebattle_support"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-white/60 transition-colors"
          >
            Soporte
          </a>
        </nav>
        <p className="font-mono text-[10px] text-white/15">
          Dice Battle · Celo Mainnet · 2026
        </p>
      </div>
    </footer>
  );
}
