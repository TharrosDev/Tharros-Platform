import { redirect } from "next/navigation";

import { getAuthUser } from "@/lib/auth/current-user";
import { getDisplayUser } from "@/lib/auth/user";
import { getOrgContext } from "@/lib/org/queries";
import { getEntitlement } from "@/lib/billing/entitlements";
import { checkQueryCap } from "@/lib/billing/usage";
import { usageBannerState } from "@/lib/billing/usage-math";
import { getUnreadCount, listNotifications } from "@/lib/notifications/queries";
import { isPlatformAdmin } from "@/lib/auth/admin";
import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";
import { FeedbackWidget } from "@/components/feedback/feedback-widget";
import { BillingBanner } from "@/components/billing/billing-banner";
import { UsageBanner } from "@/components/billing/usage-banner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ToastProvider, Toaster } from "@/components/ui/toast";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
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

  // Billing state for the app-wide dunning / trial banner. cache() dedupes this
  // with the (subscribed) gate's read within the same request.
  const entitlement = await getEntitlement();

  // AI-usage banner (Day 61): show a near-limit warning / cap-reached notice once
  // the org crosses 80% of its monthly AI cap. Only meaningful for a subscribed
  // org (cap 0 → no banner), so skip the count entirely when access is blocked.
  const usageBanner =
    entitlement.allowed && activeOrg ? usageBannerState(await checkQueryCap(activeOrg.id)) : null;

  // In-app notification inbox for the topbar bell (RLS scopes to this user).
  const [notifications, unreadCount] = await Promise.all([
    listNotifications({ limit: 10 }),
    getUnreadCount(),
  ]);

  return (
    <ToastProvider>
      <TooltipProvider>
        <a
          href="#main-content"
          className="bg-primary text-primary-foreground border-primary-edge type-control z-toast fixed top-4 left-4 -translate-y-24 border-2 px-4 py-2 transition-transform focus:translate-y-0"
        >
          Skip to content
        </a>
        <div className="bg-background flex min-h-dvh">
          <aside className="on-rack-deep seam-r w-rail sticky top-0 hidden h-dvh shrink-0 lg:block">
            <Sidebar
              user={displayUser}
              orgs={orgs}
              activeOrg={activeOrg}
              showAdmin={isPlatformAdmin(user.email)}
            />
          </aside>

          <div className="app-shell-canvas flex min-w-0 flex-1 flex-col">
            <Topbar
              user={displayUser}
              orgs={orgs}
              activeOrg={activeOrg}
              notifications={notifications}
              unreadCount={unreadCount}
            />
            <BillingBanner entitlement={entitlement} />
            <UsageBanner state={usageBanner} />
            <main
              id="main-content"
              className="max-w-board mx-auto w-full flex-1 space-y-8 px-4 py-6 sm:px-6 sm:py-8 xl:px-10"
            >
              {children}
            </main>
          </div>
        </div>
        <FeedbackWidget />
        <Toaster />
      </TooltipProvider>
    </ToastProvider>
  );
}
