"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";

/**
 * Light/dark toggle. The icon is pure CSS (Moon in light, Sun in dark via the
 * `dark:` variant) so there is no state to hydrate and no flash — this also
 * sidesteps the `react-hooks/set-state-in-effect` lint rule. The actual switch
 * is driven by next-themes, which persists the choice and respects the OS.
 */
function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      aria-label="Toggle light or dark mode"
      className={className}
    >
      <Moon className="dark:hidden" />
      <Sun className="hidden dark:block" />
    </Button>
  );
}

export { ThemeToggle };
