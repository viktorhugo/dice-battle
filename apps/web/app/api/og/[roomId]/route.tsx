import { ImageResponse } from "next/og";
import { gql } from "graphql-request";
import { indexer } from "@/lib/indexer";
import { getTokenDecimals } from "@/lib/constants";
import { getTokenSymbol } from "@/lib/utils";

export const runtime = "edge";

// ─── Types ────────────────────────────────────────────────────────────────────

type OGRoom = {
  state: string;
  playerA: string;
  playerB: string | null;
  winner: string | null;
  rollA1: number | null;
  rollA2: number | null;
  rollB1: number | null;
  rollB2: number | null;
  stake: string;
  token: string;
};

// ─── Query ────────────────────────────────────────────────────────────────────

const ROOM_OG_QUERY = gql`
  query RoomOG($id: String!) {
    Room_by_pk(id: $id) {
      state
      playerA
      playerB
      winner
      rollA1
      rollA2
      rollB1
      rollB2
      stake
      token
    }
  }
`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtAmount(raw: string, token: string): string {
  const addr = token as `0x${string}`;
  const decimals = getTokenDecimals(addr);
  const n = BigInt(raw);
  const d = BigInt(10 ** decimals);
  const whole = n / d;
  const frac = (n % d).toString().padStart(decimals, "0").slice(0, 2).replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : `${whole}`;
}

function trunc(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

// ─── Image sub-components (inline styles — Tailwind doesn't run in ImageResponse) ──

function Die({ value, highlight }: { value: number | null; highlight: boolean }) {
  return (
    <div
      style={{
        width: 96,
        height: 96,
        borderRadius: 18,
        background: highlight ? "#FCFF52" : "rgba(255,255,255,0.12)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 50,
        fontWeight: 700,
        color: highlight ? "#0C0C0C" : "white",
      }}
    >
      {value ?? "?"}
    </div>
  );
}

function PlayerColumn({
  label,
  address,
  d1,
  d2,
  won,
}: {
  label: string;
  address: string;
  d1: number | null;
  d2: number | null;
  won: boolean;
}) {
  const total = d1 != null && d2 != null ? d1 + d2 : null;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
      <div style={{ display: "flex", gap: 12 }}>
        <Die value={d1} highlight={won} />
        <Die value={d2} highlight={won} />
      </div>
      {total !== null && (
        <div style={{ fontSize: 20, fontWeight: 600, color: won ? "#FCFF52" : "rgba(255,255,255,0.45)" }}>
          = {total}
        </div>
      )}
      <div style={{ fontSize: 15, color: "rgba(255,255,255,0.4)" }}>
        {label} · {trunc(address)}
      </div>
      {won && (
        <div style={{ fontSize: 18, fontWeight: 700, color: "#FCFF52" }}>🏆 Winner</div>
      )}
    </div>
  );
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;

  let room: OGRoom | null = null;
  try {
    const data = await indexer.request<{ Room_by_pk: OGRoom | null }>(
      ROOM_OG_QUERY,
      { id: roomId }
    );
    room = data.Room_by_pk;
  } catch {
    // Indexer unavailable — render generic fallback image
  }

  const token = room?.token ?? "";
  const symbol = getTokenSymbol(token);
  const stakeStr = room ? fmtAmount(room.stake, token) : "?";
  const prizeStr = room
    ? fmtAmount((BigInt(room.stake) * 196n / 100n).toString(), token)
    : "?";

  const isResolved = room?.state === "RESOLVED";
  const isTied = room?.state === "TIED";
  const showDice = (isResolved || isTied) && room?.rollA1 != null;
  const aWon = isResolved && room?.winner?.toLowerCase() === room?.playerA?.toLowerCase();
  const bWon = isResolved && room?.winner?.toLowerCase() === room?.playerB?.toLowerCase();

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          background: "#0C0C0C",
          color: "white",
          padding: "48px 60px",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 42, fontWeight: 700 }}>
            🎲 Dice Battle #{roomId}
          </div>
          <div style={{ fontSize: 18, color: "rgba(255,255,255,0.28)" }}>
            Built for MiniPay · Celo
          </div>
        </div>

        {/* Content */}
        {showDice && room ? (
          <div
            style={{
              display: "flex",
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              gap: 64,
            }}
          >
            <PlayerColumn
              label="Host"
              address={room.playerA}
              d1={room.rollA1}
              d2={room.rollA2}
              won={aWon}
            />
            <div style={{ fontSize: 44, color: "rgba(255,255,255,0.2)" }}>vs</div>
            <PlayerColumn
              label="Guest"
              address={room.playerB ?? "?"}
              d1={room.rollB1}
              d2={room.rollB2}
              won={bWon}
            />
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              fontSize: 30,
              color: "rgba(255,255,255,0.4)",
            }}
          >
            {room?.state === "MATCHED"
              ? "⏳ Game in progress…"
              : room?.state === "OPEN"
              ? `🎲 Stake: ${stakeStr} ${symbol} each — join now!`
              : "🎲 Dice Battle"}
          </div>
        )}

        {/* Footer */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderTop: "1px solid rgba(255,255,255,0.08)",
            paddingTop: 22,
          }}
        >
          <div style={{ fontSize: 22, color: "rgba(255,255,255,0.55)" }}>
            {isTied
              ? `🤝 Tie — ${stakeStr} ${symbol} each refunded`
              : isResolved
              ? `💰 Prize: ~${prizeStr} ${symbol}`
              : `Stake: ${stakeStr} ${symbol} each`}
          </div>
          <div style={{ fontSize: 16, color: "rgba(255,255,255,0.2)" }}>
            Provably fair · onchain entropy
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
