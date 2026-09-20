import type { Metadata } from "next";
import Link from "next/link";

import { AuthCard } from "@/components/auth/auth-card";
import { ResendVerification } from "@/components/auth/resend-verification";

export const metadata: Metadata = { title: "Confirm your email" };

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; next?: string }>;
}) {
  const { email, next } = await searchParams;
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : undefined;

  return (
    <AuthCard
      title="Confirm your email"
      description={
        email ? (
          <>
            We sent a confirmation link to{" "}
            <span className="text-foreground font-medium">{email}</span>. Click it to activate your
            account.
          </>
        ) : (
          "We sent you a confirmation link. Click it to activate your account."
        )
      }
      footer={
        <Link className="text-primary font-medium hover:underline" href="/login">
          Back to sign in
        </Link>
      }
    >
      {email ? (
        <ResendVerification email={email} next={safeNext} />
      ) : (
        <p className="text-muted-foreground text-sm">
          No verification email? Check your spam folder, or{" "}
          <Link className="text-primary hover:underline" href="/signup">
            try signing up again
          </Link>
          .
        </p>
      )}
    </AuthCard>
  );
}
