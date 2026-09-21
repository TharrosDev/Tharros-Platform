import { ImageResponse } from "next/og";

export const alt = "Tharros — A clearer workday for Canadian businesses and organizations";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        width: "100%",
        height: "100%",
        background: "#edf2fd",
        color: "#24344e",
        padding: "60px 72px",
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 32, fontWeight: 700 }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 52,
            height: 52,
            borderRadius: 14,
            background: "#3657ae",
            color: "white",
          }}
        >
          T
        </div>
        Tharros
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          fontSize: 76,
          fontWeight: 700,
          letterSpacing: -3,
          lineHeight: 1.08,
        }}
      >
        <span>A little less busy.</span>
        <span style={{ color: "#3657ae" }}>A lot more together.</span>
      </div>
      <div style={{ display: "flex", fontSize: 26 }}>
        Knowledge · Scheduling · Leads · Automations
      </div>
      <div style={{ display: "flex", fontSize: 22, color: "#506078" }}>
        A shared workspace for Canadian businesses and organizations.
      </div>
    </div>,
    size,
  );
}
