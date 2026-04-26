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
  }
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const headersObj = await headers();
  const cookies = headersObj.get("cookie");

  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <meta
          name="talentapp:project_verification"
          content="db01be4b652b1ca0a790a844c040bcb2876355ae796c7ac076b3a233cdb62467239783d989c5f185eb4ce3f5cc9f2bae3ee6c708744fae3c0a6ac27e575499b3"
        />
      </head>
      <body suppressHydrationWarning>
        <ContextProvider cookies={cookies}>
          <main className="min-h-screen mx-auto max-w-md px-4 py-6">{children}</main>
        </ContextProvider>
      </body>
    </html>
  );
}
