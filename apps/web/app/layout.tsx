import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";
import ContextProvider from "./context/wagmi-provider";
import { Inter, Space_Grotesk } from "next/font/google";
import { cn } from "@/lib/utils";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });
const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-heading',
  weight: ['500', '600', '700'],
});

function getBaseUrl(): URL {
  // 1. Explicit canonical URL (set in Vercel env vars for custom domains)
  if (process.env.NEXT_PUBLIC_URL) return new URL(process.env.NEXT_PUBLIC_URL);
  // 2. Auto-injected by Vercel for every deployment (preview + production)
  if (process.env.VERCEL_URL) return new URL(`https://${process.env.VERCEL_URL}`);
  // 3. Local dev fallback
  return new URL("http://localhost:3000");
}

const APP_DESCRIPTION = "PvP dice battle on Celo. Stake, roll, win — all onchain, all in MiniPay.";

export const metadata: Metadata = {
  metadataBase: getBaseUrl(),
  title: "Dice Battle 🎲",
  description: APP_DESCRIPTION,
  icons: {
    icon: [{ url: "/images/favicon.webp", type: "image/png" }],
    apple: "/images/favicon.webp",
    shortcut: "/images/favicon.webp",
  },
  openGraph: {
    title: "Dice Battle 🎲",
    description: APP_DESCRIPTION,
    type: "website",
    images: [{ url: "/api/og", width: 1200, height: 630, alt: "Dice Battle — PvP dice game on Celo" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Dice Battle 🎲",
    description: APP_DESCRIPTION,
    images: ["/api/og"],
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const headersObj = await headers();
  const cookies = headersObj.get("cookie");
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning className={cn("font-sans", inter.variable, spaceGrotesk.variable)}>
      <head>
        <meta
          name="talentapp:project_verification"
          content="db01be4b652b1ca0a790a844c040bcb2876355ae796c7ac076b3a233cdb62467239783d989c5f185eb4ce3f5cc9f2bae3ee6c708744fae3c0a6ac27e575499b3"
        />
      </head>
      <body suppressHydrationWarning>
        <ContextProvider cookies={cookies}>
          <NextIntlClientProvider locale={locale} messages={messages}>
            <main className="min-h-screen mx-auto max-w-md px-4 py-6">{children}</main>
          </NextIntlClientProvider>
        </ContextProvider>
      </body>
    </html>
  );
}
