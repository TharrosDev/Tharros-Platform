import { Lock, Building2 } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";

/*
  Two states that were being rendered four different ways across the app: a
  bare <p>, a FormMessage, a bordered paragraph and a muted line. They mean the
  same thing wherever they appear, so they look the same wherever they appear.
*/

/**
 * No organization is selected. Shown by settings surfaces that need one before
 * they can read or write anything.
 */
function NoActiveOrg({ what }: { what: string }) {
  return (
    <EmptyState
      icon={<Building2 />}
      title="No organization selected"
      description={`Select or create an organization before you can ${what}.`}
    />
  );
}

/**
 * The visitor is signed in and in the right org, but their role does not cover
 * this surface. It names who can, so the reader knows who to ask.
 */
function RoleDenied({ what, who }: { what: string; who: "owner" | "managers" }) {
  return (
    <EmptyState
      icon={<Lock />}
      title={`You do not have access to ${what}`}
      description={
        who === "owner"
          ? "Only the organization owner can see this. Ask them if you need it."
          : "Owners and admins handle this. Ask one of them if you need it."
      }
    />
  );
}

export { NoActiveOrg, RoleDenied };
