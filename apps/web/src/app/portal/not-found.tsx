import { FileQuestion } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";

/**
 * The portal is account-less and token-scoped, so a 404 here cannot offer a
 * dashboard link: there is nothing an employee can sign in to.
 */
export default function PortalNotFound() {
  return (
    <div className="mx-auto w-full max-w-md px-4 py-12">
      <EmptyState
        headingLevel="h1"
        icon={<FileQuestion />}
        title="This page is not available."
        description="Your link may have expired. Ask your manager to send a new one."
      />
    </div>
  );
}
