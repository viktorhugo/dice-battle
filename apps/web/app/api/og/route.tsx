import { ImageResponse } from "next/og";

export const runtime = "edge";

export function GET() {
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
          fontFamily: "system-ui, sans-serif",
          padding: "60px 72px",
          justifyContent: "space-between",
        }}
      >
        {/* Top — badge */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 999,
            padding: "8px 20px",
            width: "fit-content",
          }}
        >
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "#00C4B3",
            }}
          />
          <span style={{ fontSize: 16, color: "rgba(255,255,255,0.55)", letterSpacing: 2 }}>
            BUILT FOR MINIPAY · CELO MAINNET
          </span>
        </div>

        {/* Center — title + tagline */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Dice row */}
          <div style={{ display: "flex", gap: 16, marginBottom: 8 }}>
            {[5, 3, 6, 4].map((v, i) => (
              <div
                key={i}
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: 16,
                  background: i % 2 === 0 ? "#FCFF52" : "rgba(255,255,255,0.1)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 40,
                  fontWeight: 700,
                  color: i % 2 === 0 ? "#0C0C0C" : "white",
                }}
              >
                {v}
              </div>
            ))}
          </div>

          <div
            style={{
              fontSize: 80,
              fontWeight: 700,
              lineHeight: 1,
              letterSpacing: -2,
            }}
          >
            <span style={{ color: "#FCFF52" }}>Dice</span>
            <span style={{ color: "white" }}> Battle</span>
          </div>

          <div style={{ fontSize: 28, color: "rgba(255,255,255,0.55)", fontWeight: 400 }}>
            PvP dice battle on Celo. Stake, roll, win — all onchain.
          </div>
        </div>

        {/* Bottom — features row */}
        <div style={{ display: "flex", gap: 24 }}>
          {[
            { label: "Provably Fair", accent: "#00C4B3" },
            { label: "Instant Payouts", accent: "#FCFF52" },
            { label: "Stablecoin Native", accent: "#00C4B3" },
            { label: "No Bookie", accent: "#FCFF52" },
          ].map(({ label, accent }) => (
            <div
              key={label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 999,
                padding: "8px 18px",
              }}
            >
              <div
                style={{ width: 7, height: 7, borderRadius: "50%", background: accent }}
              />
              <span style={{ fontSize: 16, color: "rgba(255,255,255,0.6)" }}>{label}</span>
            </div>
          ))}
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
