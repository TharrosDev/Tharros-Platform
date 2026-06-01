import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/org/queries";
import { TharrosWordmark } from "@/components/brand/logo";

/**
 * Layout for the first-run onboarding wizard. Requires a signed-in user and an
 * un-onboarded active org; once onboarding is done, bounces back into the app.
 */
export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { needsOnboarding } = await getOrgContext();
  if (!needsOnboarding) redirect("/dashboard");

  return (
    <div className="bg-background flex min-h-screen flex-col items-center justify-center gap-8 px-4 py-12">
      <TharrosWordmark markClassName="size-7" />
      {children}
    </div>
  );
}
