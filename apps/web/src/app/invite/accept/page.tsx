import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/current-user";
import { TharrosWordmark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Accept invite" };

// The token redemption mutates state — never serve a cached render.
export const dynamic = "force-dynamic";

/**
 * Team-invite accept landing. Lives outside the (auth)/(app) route groups so it
 * can handle both signed-out and signed-in visitors:
 *   - no token        → bounce to /login with an invite error
 *   - signed out      → send to /login?next=<this url> (signup link carries it
 *                       too); they return here after authenticating
 *   - signed in       → redeem the token via accept_invite, land on /dashboard
 *
 * `/invite` is in PUBLIC_PATHS so the proxy lets this page run instead of doing
 * its own bounce (which would drop the token).
 */
export default async function AcceptInvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  if (!token) redirect("/login?error=invite_invalid");

  const user = await getAuthUser();
  if (!user) {
    const next = `/invite/accept?token=${encodeURIComponent(token)}`;
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_invite", { p_token: token });
  if (!error) redirect("/dashboard");

  return (
    <div className="bg-background flex min-h-screen flex-col items-center justify-center gap-8 px-4 py-12">
      <TharrosWordmark markClassName="size-7" />
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>We couldn&apos;t accept this invite</CardTitle>
          <CardDescription>{error.message}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="w-full">
            <Link href="/dashboard">Go to your dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
