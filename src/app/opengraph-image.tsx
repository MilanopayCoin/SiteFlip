import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "JIY.APP — Verified digital businesses";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 80,
          background: "linear-gradient(145deg, #0a0a0b 0%, #141418 50%, #0f0f12 100%)",
          color: "#fafafa",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div
          style={{
            fontSize: 28,
            letterSpacing: 6,
            textTransform: "uppercase",
            color: "#a78bfa",
            marginBottom: 24,
          }}
        >
          JIY
        </div>
        <div style={{ fontSize: 64, fontWeight: 700, lineHeight: 1.1, maxWidth: 900 }}>
          Verified digital businesses
        </div>
        <div style={{ fontSize: 28, marginTop: 32, color: "#a1a1aa", maxWidth: 800 }}>
          Buy, rent, revive, and sell with evidence-backed verification.
        </div>
      </div>
    ),
    { ...size }
  );
}
