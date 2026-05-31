"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogPortal,
  DialogBackdrop,
  DialogPrimitive,
} from "@/components/ui/dialog";
import { allNav } from "@/components/shell/nav";

/**
 * Command palette stub. Opens on ⌘K / Ctrl+K (handled by the parent topbar) or
 * via the search button. Filters the static nav list by label and routes on
 * select. Real fuzzy search and richer actions land in a later phase.
 */
function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [active, setActive] = React.useState(0);

  const results = allNav.filter((item) =>
    item.label.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const activeIndex = results.length ? Math.min(active, results.length - 1) : 0;

  function go(href: string) {
    onOpenChange(false);
    setQuery("");
    setActive(0);
    router.push(href);
  }

  function onInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const item = results[activeIndex];
      if (item) go(item.href);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) {
          setQuery("");
          setActive(0);
        }
      }}
    >
      <DialogPortal>
        <DialogBackdrop />
        <DialogPrimitive.Viewport className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 pt-[12vh]">
          <DialogPrimitive.Popup className="bg-popover text-popover-foreground shadow-popover w-full max-w-xl overflow-hidden rounded-xl border border-border/60 outline-none transition-all duration-200 ease-out data-[starting-style]:scale-95 data-[starting-style]:opacity-0 data-[ending-style]:scale-95 data-[ending-style]:opacity-0">
            <DialogPrimitive.Title className="sr-only">
              Command menu
            </DialogPrimitive.Title>

            <div className="flex items-center gap-2.5 border-b border-border/60 px-4">
              <Search className="text-muted-foreground size-4 shrink-0" />
              <input
                autoFocus
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setActive(0);
                }}
                onKeyDown={onInputKeyDown}
                placeholder="Search or jump to…"
                aria-label="Search or jump to"
                className="placeholder:text-muted-foreground h-12 w-full bg-transparent text-sm outline-none"
              />
            </div>

            <div className="max-h-80 overflow-y-auto p-2">
              {results.length === 0 ? (
                <p className="text-muted-foreground px-3 py-6 text-center text-sm">
                  No matches.
                </p>
              ) : (
                results.map((item, index) => {
                  const Icon = item.icon;
                  const isActive = index === activeIndex;
                  return (
                    <button
                      key={item.href}
                      type="button"
                      onClick={() => go(item.href)}
                      onMouseMove={() => setActive(index)}
                      data-active={isActive || undefined}
                      className={cn(
                        "focus-visible:ring-ring/40 flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm outline-none transition-colors focus-visible:ring-[3px]",
                        isActive ? "bg-accent text-foreground" : "hover:bg-accent",
                      )}
                    >
                      <Icon className="text-muted-foreground size-4 shrink-0" />
                      <span className="flex-1">{item.label}</span>
                      <span className="text-muted-foreground text-xs">
                        {item.href}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </DialogPrimitive.Popup>
        </DialogPrimitive.Viewport>
      </DialogPortal>
    </Dialog>
  );
}

export { CommandPalette };
