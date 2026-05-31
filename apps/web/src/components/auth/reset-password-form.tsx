"use client";

import { useActionState } from "react";

import { updatePassword } from "@/lib/auth/actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { AuthCard, FieldError, FormMessage } from "@/components/auth/auth-card";

export function ResetPasswordForm() {
  const [state, action, pending] = useActionState(updatePassword, undefined);

  return (
    <AuthCard
      title="Choose a new password"
      description="Enter a new password for your account."
    >
      <form action={action} className="space-y-4" noValidate>
        {state?.message ? <FormMessage>{state.message}</FormMessage> : null}

        <div className="space-y-1.5">
          <Label htmlFor="password">New password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            aria-invalid={Boolean(state?.errors?.password)}
            aria-describedby="password-hint"
            required
          />
          {state?.errors?.password?.[0] ? (
            <FieldError message={state.errors.password[0]} />
          ) : (
            <p id="password-hint" className="text-muted-foreground text-sm">
              At least 8 characters, with a letter and a number.
            </p>
          )}
        </div>

        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Saving…" : "Update password"}
        </Button>
      </form>
    </AuthCard>
  );
}
