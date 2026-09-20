import { FileQuestion } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { TharrosWordmark } from "@/components/brand/logo";

/**
 * A stranger who opens a dead capture link used to get the app 404, whose only
 * action was "Go to dashboard". They have no dashboard.
 */
export default function FormNotFound() {
  return (
    <main className="flex min-h-dvh flex-col">
      <div className="border-border flex items-center border-b px-5 py-4">
        <TharrosWordmark markClassName="size-6" />
      </div>
      <div className="mx-auto flex w-full max-w-xl flex-1 items-center px-5 py-14">
        <EmptyState
          className="w-full"
          headingLevel="h1"
          icon={<FileQuestion />}
          title="This form is no longer accepting responses."
          description="The link may have expired or been turned off. If you were asked to fill this in, contact the business directly."
        />
      </div>
    </main>
  );
}
