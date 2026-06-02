"use client";

import * as React from "react";
import { useActionState } from "react";

import { updateProfile } from "@/lib/profile/actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { FieldError, FormMessage } from "@/components/auth/auth-card";
import { useToast } from "@/components/ui/toast";

/** Edit the signed-in user's display name. Email is shown read-only. */
export function ProfileForm({
  fullName,
  email,
}: {
  fullName: string;
  email: string;
}) {
  const [state, action, pending] = useActionState(updateProfile, undefined);
  const toast = useToast();
  const lastHandled = React.useRef<typeof state>(null);

  React.useEffect(() => {
    if (state?.ok && state !== lastHandled.current) {
      lastHandled.current = state;
      toast.add({ title: "Profile", description: state.message });
    }
  }, [state, toast]);

  return (
    <form action={action} className="space-y-4" noValidate>
      {state?.message && !state.ok ? <FormMessage>{state.message}</FormMessage> : null}

      <div className="space-y-1.5">
        <Label htmlFor="fullName">Name</Label>
        <Input
          id="fullName"
          name="fullName"
          type="text"
          autoComplete="name"
          defaultValue={state?.values?.fullName ?? fullName}
          aria-invalid={Boolean(state?.errors?.fullName)}
          required
        />
        <FieldError message={state?.errors?.fullName?.[0]} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" value={email} disabled readOnly />
        <p className="text-muted-foreground text-sm">
          Your sign-in email. Contact support to change it.
        </p>
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}
