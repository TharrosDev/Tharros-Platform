"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * App-wide theme provider. System-aware and persistent: next-themes writes the
 * choice to localStorage, follows the OS setting in `system` mode, and injects a
 * pre-hydration script so there is no dark-mode flash on load. Toggles the `dark`
 * class on <html> to drive the Maple Pure token set in globals.css.
 */
function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider
      // The anti-flash script only needs to run from the server HTML. On the
      // client React 19 warns about rendering an executable <script>, so mark it
      // an inert data block there (next-themes sets suppressHydrationWarning).
      scriptProps={{ type: typeof window === "undefined" ? "text/javascript" : "text/plain" }}
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}

export { ThemeProvider };
