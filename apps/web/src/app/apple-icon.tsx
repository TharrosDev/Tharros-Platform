import { ImageResponse } from "next/og";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";
export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        height: "100%",
        borderRadius: 42,
        background: "#3657ae",
        color: "#fff",
        fontSize: 128,
        fontWeight: 800,
        fontFamily: "sans-serif",
      }}
    >
      T
    </div>,
    size,
  );
}
