"use client";

import Link from "next/link";
import { useActionState } from "react";

import { signUp } from "@/lib/auth/actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { AuthCard, FieldError, FormMessage } from "@/components/auth/auth-card";

export function SignupForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(signUp, undefined);
  const loginHref = next ? `/login?next=${encodeURIComponent(next)}` : "/login";

  return (
    <AuthCard
      title="Create your account"
      description="Start running your business on Tharros."
      footer={
        <>
          Already have an account?{" "}
          <Link className="text-primary font-medium hover:underline" href={loginHref}>
            Sign in
          </Link>
        </>
      }
    >
      <form action={action} className="space-y-4" noValidate>
        {next ? <input type="hidden" name="next" value={next} /> : null}
        {state?.message ? <FormMessage>{state.message}</FormMessage> : null}

        <div className="space-y-1.5">
          <Label htmlFor="fullName">Full name</Label>
          <Input
            id="fullName"
            name="fullName"
            type="text"
            autoComplete="name"
            defaultValue={state?.values?.fullName}
            aria-invalid={Boolean(state?.errors?.fullName)}
            required
          />
          <FieldError message={state?.errors?.fullName?.[0]} />
        </div>

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

        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
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
          {pending ? "Creating account…" : "Create account"}
        </Button>
      </form>
    </AuthCard>
  );
}
