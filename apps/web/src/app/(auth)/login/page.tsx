import type { Metadata } from "next";

import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;
  const notice =
    error === "link_invalid"
      ? "That link is invalid or has expired. Sign in, or request a new one."
      : error === "invite_invalid"
        ? "That invite link is invalid or has expired. Ask for a new one."
        : undefined;
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : undefined;

  return <LoginForm notice={notice} next={safeNext} />;
}
