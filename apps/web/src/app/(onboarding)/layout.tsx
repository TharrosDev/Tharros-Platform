import { redirect } from "next/navigation";

import { getAuthUser } from "@/lib/auth/current-user";
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
  const user = await getAuthUser();
  if (!user) redirect("/login");

  const { needsOnboarding } = await getOrgContext();
  if (!needsOnboarding) redirect("/dashboard");

  return (
    <div className="bg-background relative flex min-h-screen flex-col items-center justify-center gap-8 px-4 py-12">
      <div
        aria-hidden
        className="text-foreground pointer-events-none absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage: "radial-gradient(currentColor 1px, transparent 1px)",
          backgroundSize: "22px 22px",
        }}
      />
      <TharrosWordmark markClassName="size-7" className="relative" />
      <div className="relative w-full max-w-sm">{children}</div>
    </div>
  );
}
