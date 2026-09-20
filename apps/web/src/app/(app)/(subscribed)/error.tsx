"use client";

import { TriangleAlert } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";

/**
 * Scoped to the paid product surfaces. Without this, a failure here unwound to the app-wide boundary and took
 * the whole shell with it; the rail and topbar now survive and you keep your
 * place in the product.
 */
export default function SectionError({ reset }: { error: Error; reset: () => void }) {
  return (
    <EmptyState
      tone="danger"
      icon={<TriangleAlert />}
      title="This page did not load."
      description="Nothing was lost. Try again, and if it keeps happening the error has been recorded for us."
      action={
        <Button type="button" onClick={reset}>
          Try again
        </Button>
      }
    />
  );
}
