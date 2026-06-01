import { redirect } from "next/navigation";

import { getAuthUser } from "@/lib/auth/current-user";
import { getDisplayUser } from "@/lib/auth/user";
import { getOrgContext } from "@/lib/org/queries";
import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ToastProvider, Toaster } from "@/components/ui/toast";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Authoritative auth gate: getAuthUser() verifies the JWT with Supabase. The
  // proxy does an optimistic redirect, but this is the check we actually trust.
  const user = await getAuthUser();
  if (!user) redirect("/login");

  // Org gate: an un-onboarded active org must finish the first-run wizard before
  // reaching the shell. Authoritative companion to the proxy's optimistic check.
  const { orgs, activeOrg, needsOnboarding } = await getOrgContext();
  if (needsOnboarding) redirect("/onboarding");

  const displayUser = getDisplayUser(user);
  displayUser.company = activeOrg?.name ?? null;

  return (
    <ToastProvider>
      <TooltipProvider>
        <div className="bg-background flex min-h-screen">
          <aside className="bg-sidebar text-sidebar-foreground sticky top-0 hidden h-screen w-64 shrink-0 border-r border-sidebar-border lg:block">
            <Sidebar user={displayUser} orgs={orgs} activeOrg={activeOrg} />
          </aside>

          <div className="flex min-w-0 flex-1 flex-col">
            <Topbar user={displayUser} orgs={orgs} activeOrg={activeOrg} />
            <main className="mx-auto w-full max-w-5xl flex-1 space-y-8 px-4 py-8 sm:px-6 sm:py-10">
              {children}
            </main>
          </div>
        </div>
        <Toaster />
      </TooltipProvider>
    </ToastProvider>
  );
}
