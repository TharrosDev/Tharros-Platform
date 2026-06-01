"use client";

import Link from "next/link";
import { useActionState } from "react";

import { logIn } from "@/lib/auth/actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { AuthCard, FieldError, FormMessage } from "@/components/auth/auth-card";

export function LoginForm({ notice, next }: { notice?: string; next?: string }) {
  const [state, action, pending] = useActionState(logIn, undefined);
  const signupHref = next ? `/signup?next=${encodeURIComponent(next)}` : "/signup";

  return (
    <AuthCard
      title="Welcome back"
      description="Sign in to your Tharros workspace."
      footer={
        <>
          New to Tharros?{" "}
          <Link className="text-primary font-medium hover:underline" href={signupHref}>
            Create an account
          </Link>
        </>
      }
    >
      <form action={action} className="space-y-4" noValidate>
        {next ? <input type="hidden" name="next" value={next} /> : null}
        {notice && !state?.message ? <FormMessage>{notice}</FormMessage> : null}
        {state?.message ? <FormMessage>{state.message}</FormMessage> : null}

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
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link
              href="/forgot-password"
              className="text-muted-foreground hover:text-foreground text-sm"
            >
              Forgot?
            </Link>
          </div>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            aria-invalid={Boolean(state?.errors?.password)}
            required
          />
          <FieldError message={state?.errors?.password?.[0]} />
        </div>

        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </AuthCard>
  );
}
