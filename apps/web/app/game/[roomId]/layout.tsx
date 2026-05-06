import type { Metadata } from "next";

type Props = {
  params: Promise<{ roomId: string }>;
  children: React.ReactNode;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { roomId } = await params;

  return {
    title: `Dice Battle #${roomId}`,
    openGraph: {
      title: `Dice Battle #${roomId}`,
      description: "PvP dice battle on Celo — roll the dice, winner takes the pot.",
      images: [{ url: `/api/og/${roomId}`, width: 1200, height: 630, alt: `Dice Battle #${roomId}` }],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `Dice Battle #${roomId}`,
      images: [`/api/og/${roomId}`],
    },
  };
}

export default function GameLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
