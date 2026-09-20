import Link from "next/link";
import { FileQuestion } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { buttonVariants } from "@/components/ui/button";

/**
 * The signed-in 404. The root not-found serves strangers on public routes and
 * should not be the one that answers a bad link inside the workspace.
 */
export default function AppNotFound() {
  return (
    <EmptyState
      headingLevel="h1"
      icon={<FileQuestion />}
      title="That page is not on the board."
      description="The link may be old, or the item may have been removed by someone on your team."
      action={
        <Link href="/dashboard" className={buttonVariants()}>
          Back to the board
        </Link>
      }
    />
  );
}
