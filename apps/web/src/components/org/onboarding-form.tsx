"use client";

import { useActionState } from "react";

import { completeOnboarding } from "@/lib/org/actions";
import { Button } from "@/components/ui/button";
import { OrgFields } from "@/components/org/org-fields";
import { AuthCard, FormMessage } from "@/components/auth/auth-card";

/** First-run wizard: fills business identity on the auto-provisioned org. */
export function OnboardingForm({ orgId }: { orgId: string }) {
  const [state, action, pending] = useActionState(completeOnboarding, undefined);

  return (
    <AuthCard
      title="Tell us about your business"
      description="A few details so Tharros fits the way you work."
    >
      <form action={action} className="space-y-4" noValidate>
        {state?.message ? <FormMessage>{state.message}</FormMessage> : null}
        <input type="hidden" name="orgId" value={orgId} />
        <OrgFields state={state} autoFocus />
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Saving…" : "Continue to dashboard"}
        </Button>
      </form>
    </AuthCard>
  );
}
