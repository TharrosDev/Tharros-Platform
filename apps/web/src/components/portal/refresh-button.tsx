"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/**
 * Re-fetches the portal schedule from the server (the page is force-dynamic,
 * so a refresh re-reads shifts, offers, swaps, and time off). The icon spins
 * while the new data loads.
 */
export function RefreshButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() => startTransition(() => router.refresh())}
      aria-label="Refresh schedule"
    >
      <RefreshCw
        className={cn("size-4", pending && "animate-spin motion-reduce:animate-none")}
        aria-hidden
      />
      {pending ? "Refreshing…" : "Refresh"}
    </Button>
  );
}
