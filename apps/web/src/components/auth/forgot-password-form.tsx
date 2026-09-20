"use client";

import Link from "next/link";
import { useActionState } from "react";

import { requestPasswordReset } from "@/lib/auth/actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { AuthCard, FieldError, FormMessage } from "@/components/auth/auth-card";

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, undefined);
  const sent = state?.message === "sent";

  return (
    <AuthCard
      title="Reset your password"
      description={sent ? undefined : "Enter your email and we'll send you a reset link."}
      footer={
        <>
          Remembered it?{" "}
          <Link className="text-primary-soft-foreground font-medium hover:underline" href="/login">
            Back to sign in
          </Link>
        </>
      }
    >
      {sent ? (
        <FormMessage tone="success">
          If an account exists for that email, a reset link is on its way. Check your inbox.
        </FormMessage>
      ) : (
        <form action={action} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              defaultValue={state?.values?.email}
              aria-invalid={Boolean(state?.errors?.email)}
              required
            />
            <FieldError message={state?.errors?.email?.[0]} />
          </div>

          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Sending…" : "Send reset link"}
          </Button>
        </form>
      )}
    </AuthCard>
  );
}
