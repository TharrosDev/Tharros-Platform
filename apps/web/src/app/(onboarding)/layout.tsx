import { redirect } from "next/navigation";
import Link from "next/link";

import { getAuthUser } from "@/lib/auth/current-user";
import { getOrgContext } from "@/lib/org/queries";
import { TharrosWordmark } from "@/components/brand/logo";

/**
 * Layout for the first-run onboarding wizard. Requires a signed-in user and an
 * un-onboarded active org; once onboarding is done, bounces back into the app.
 */
export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const user = await getAuthUser();
  if (!user) redirect("/login");

  const { needsOnboarding } = await getOrgContext();
  if (!needsOnboarding) redirect("/dashboard");

  return (
    <div className="app-shell-canvas relative flex min-h-screen flex-col items-center justify-center gap-8 px-4 py-12 sm:px-8">
      <Link
        href="/"
        aria-label="Tharros home"
        className="focus-visible:ring-ring/40 relative rounded-lg outline-none focus-visible:ring-[3px]"
      >
        <TharrosWordmark markClassName="size-7" />
      </Link>
      <div className="relative w-full max-w-md">{children}</div>
    </div>
  );
}
