import type { Metadata } from "next";
import { Providers } from "@/components/Providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dice Battle 🎲",
  description: "PvP dice battle on Celo. Stake, roll, win — all onchain, all in MiniPay.",
  openGraph: {
    title: "Dice Battle 🎲",
    description: "PvP dice battle on Celo. Stake, roll, win — all onchain, all in MiniPay.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <Providers>
          <main className="min-h-screen mx-auto max-w-md px-4 py-6">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
