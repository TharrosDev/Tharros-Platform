import type { Metadata } from "next";
import { Nunito_Sans, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

import { MotionProvider } from "@/components/motion";

const archivo = Nunito_Sans({
  variable: "--font-archivo",
  subsets: ["latin"],

  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://tharros.ca"),
  title: {
    default: "Tharros — A clearer workday for Canadian organizations",
    template: "%s | Tharros",
  },
  description:
    "Business knowledge, workforce scheduling, lead capture and native automation in one workspace for Canadian businesses and organizations.",
  applicationName: "Tharros",
  openGraph: {
    type: "website",
    siteName: "Tharros",
    title: "Tharros — A clearer workday for Canadian organizations",
    description:
      "Business knowledge, workforce scheduling, lead capture and native automation in one workspace for Canadian businesses and organizations.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const enableVercelTelemetry = process.env.NODE_ENV === "production" && process.env.VERCEL === "1";

  return (
    <html lang="en" className={`${archivo.variable} ${geistMono.variable}`}>
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
