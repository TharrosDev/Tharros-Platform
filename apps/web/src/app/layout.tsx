import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

import { MotionProvider } from "@/components/motion";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://tharros.ca"),
  title: {
    default: "Tharros — AI operating workspace for small businesses",
    template: "%s | Tharros",
  },
  description:
    "Business knowledge, workforce scheduling, lead capture and native automation in one operating workspace for small teams.",
  applicationName: "Tharros",
  openGraph: {
    type: "website",
    siteName: "Tharros",
    title: "Tharros — AI operating workspace for small businesses",
    description:
      "Business knowledge, workforce scheduling, lead capture and native automation in one operating workspace for small teams.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const enableVercelTelemetry =
    process.env.NODE_ENV === "production" && process.env.VERCEL === "1";

  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <MotionProvider>{children}</MotionProvider>
        {enableVercelTelemetry ? (
          <>
            <Analytics />
            <SpeedInsights />
          </>
        ) : null}
      </body>
    </html>
  );
}
