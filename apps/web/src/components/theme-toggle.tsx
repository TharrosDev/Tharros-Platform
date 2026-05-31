"use client";

import { Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Lightweight light/dark toggle for the Day 5 proof screen — flips the `dark`
 * class on <html>. Both icons render; the `dark:` variant shows the right one,
 * so there is no state to hydrate. A persistent, system-aware theme provider
 * lands in Day 6.
 */
function ThemeToggle({ className }: { className?: string }) {
  function toggle() {
    document.documentElement.classList.toggle("dark");
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label="Toggle light or dark mode"
      className={className}
    >
      <Moon className="dark:hidden" />
      <Sun className="hidden dark:block" />
    </Button>
  );
}

export { ThemeToggle };
