import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

import { ThemeProvider } from "@/components/theme-provider";
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
    default: "Tharros — AI business assistant and workforce scheduling",
    template: "%s | Tharros",
  },
  description:
    "A grounded AI business assistant and workforce scheduling workspace for small teams.",
  applicationName: "Tharros",
  openGraph: {
    type: "website",
    siteName: "Tharros",
    title: "Tharros — AI business assistant and workforce scheduling",
    description:
      "A grounded AI business assistant and workforce scheduling workspace for small teams.",
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
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable}`}
    >
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <MotionProvider>{children}</MotionProvider>
        </ThemeProvider>
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
