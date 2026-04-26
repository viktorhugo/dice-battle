import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";
import ContextProvider from "./context/wagmi-provider";

export const metadata: Metadata = {
  title: "Dice Battle 🎲",
  description: "PvP dice battle on Celo. Stake, roll, win — all onchain, all in MiniPay.",
  openGraph: {
    title: "Dice Battle 🎲",
    description: "PvP dice battle on Celo. Stake, roll, win — all onchain, all in MiniPay.",
    type: "website",
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const headersObj = await headers();
  const cookies = headersObj.get("cookie");

  return (
    <html lang="es" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <ContextProvider cookies={cookies}>
          <main className="min-h-screen mx-auto max-w-md px-4 py-6">{children}</main>
        </ContextProvider>
      </body>
    </html>
  );
}
