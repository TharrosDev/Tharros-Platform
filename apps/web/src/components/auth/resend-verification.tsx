"use client";

import { useActionState } from "react";

import { resendVerification } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/auth/auth-card";

/** Re-sends the signup confirmation email for a known address. */
export function ResendVerification({ email, next }: { email: string; next?: string }) {
  const [state, action, pending] = useActionState(resendVerification, undefined);
  const resent = state?.message === "resent";

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="email" value={email} />
      {next ? <input type="hidden" name="next" value={next} /> : null}
      {resent ? (
        <FormMessage tone="success">
          Sent again. Give it a minute, then check your inbox and spam folder.
        </FormMessage>
      ) : null}
      <Button type="submit" variant="outline" className="w-full" disabled={pending || !email}>
        {pending ? "Resending…" : "Resend confirmation email"}
      </Button>
    </form>
  );
}
