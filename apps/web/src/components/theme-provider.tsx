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
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}

export { ThemeProvider };
