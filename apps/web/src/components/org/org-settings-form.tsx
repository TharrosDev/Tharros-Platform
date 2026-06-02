"use client";

import * as React from "react";
import { useActionState } from "react";

import { updateOrganization } from "@/lib/org/actions";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/auth/auth-card";
import { OrgFields } from "@/components/org/org-fields";
import { useToast } from "@/components/ui/toast";

/**
 * Edit the active org's business identity. Reuses the shared OrgFields used by
 * onboarding + create-org. Rendered only for owners; non-owners see a read-only
 * notice on the page instead.
 */
export function OrgSettingsForm({
  defaults,
}: {
  defaults: { name: string; industry: string; size: string };
}) {
  const [state, action, pending] = useActionState(updateOrganization, {
    values: defaults,
  });
  const toast = useToast();
  const lastHandled = React.useRef<typeof state>(null);

  React.useEffect(() => {
    if (state?.ok && state !== lastHandled.current) {
      lastHandled.current = state;
      toast.add({ title: "Business profile", description: state.message });
    }
  }, [state, toast]);

  return (
    <form action={action} className="space-y-4" noValidate>
      {state?.message && !state.ok ? <FormMessage>{state.message}</FormMessage> : null}
      <OrgFields state={state} />
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}
