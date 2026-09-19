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
    <div className="app-shell-canvas relative flex min-h-screen flex-col items-center justify-center gap-8 overflow-hidden px-4 py-12 sm:px-8 before:pointer-events-none before:absolute before:-top-36 before:right-[10%] before:size-[28rem] before:rounded-full before:bg-primary/12 before:blur-[100px]">
      <Link
        href="/"
        aria-label="Tharros home"
        className="focus-visible:ring-ring/30 relative rounded-xl border border-border/60 bg-card/65 px-3 py-2 shadow-card backdrop-blur-lg outline-none focus-visible:ring-[4px]"
      >
        <TharrosWordmark markClassName="size-7" />
      </Link>
      <div className="relative w-full max-w-lg">{children}</div>
    </div>
  );
}
