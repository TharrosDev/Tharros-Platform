import type { Metadata } from "next";

import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const notice =
    error === "link_invalid"
      ? "That link is invalid or has expired. Sign in, or request a new one."
      : undefined;

  return <LoginForm notice={notice} />;
}
