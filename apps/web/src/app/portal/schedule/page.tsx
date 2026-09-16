import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { getPortalSession } from "@/lib/portal/session";
import {
  getPortalSchedule,
  getOpenOffers,
  getSickCallReasonPolicy,
  getProposableCoworkers,
  getIncomingSwaps,
  getOpenSwaps,
  getMyTimeOff,
} from "@/lib/portal/schedule";
import { signOutPortal } from "@/lib/portal/actions";
import { Button } from "@/components/ui/button";
import {
  PortalFooter,
  PortalHeader,
  PortalInactive,
  PortalShell,
} from "@/components/portal/portal-chrome";
import { RefreshButton } from "@/components/portal/refresh-button";
import { PortalSchedule } from "@/components/portal/portal-schedule";
import { ReplacementOffers } from "@/components/portal/replacement-offers";
import { SwapInbox } from "@/components/portal/swap-inbox";
import { TimeOffSection } from "@/components/portal/time-off-section";

export const metadata: Metadata = {
  title: "My schedule",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function PortalSchedulePage() {
  const session = await getPortalSession();
  const [shifts, offers, reasonPolicy, coworkers, incomingSwaps, openSwaps, timeOff] = session
    ? await Promise.all([
        getPortalSchedule(session.employeeId, session.orgId),
        getOpenOffers(session.employeeId, session.orgId),
        getSickCallReasonPolicy(session.orgId),
        getProposableCoworkers(session.employeeId, session.orgId),
        getIncomingSwaps(session.employeeId, session.orgId),
        getOpenSwaps(session.employeeId, session.orgId),
        getMyTimeOff(session.employeeId, session.orgId),
      ])
    : [[], [], "optional" as const, [], [], [], []];

  return (
    <PortalShell className="lg:max-w-6xl lg:px-10">
      <PortalHeader>
        {session ? (
          <form action={signOutPortal}>
            <Button type="submit" variant="ghost" size="sm">
              Sign out
            </Button>
          </form>
        ) : null}
      </PortalHeader>

      {session ? (
        <div className="flex flex-1 flex-col">
          <Link
            href="/portal"
            className="text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-ring/40 mb-4 inline-flex min-h-10 w-fit items-center gap-1 rounded-lg px-2 text-sm outline-none focus-visible:ring-[3px]"
          >
            <ChevronLeft className="size-4" /> Portal
          </Link>
          <p className="text-muted-foreground type-meta">{session.orgName}</p>
          <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
            <h1 className="type-h1">Your schedule</h1>
            <RefreshButton />
          </div>
          <p className="text-muted-foreground mt-2 type-body">
            Your shifts for the next two weeks.
          </p>

          <div className="mt-6 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)] lg:items-start lg:gap-10">
            <div className="space-y-6 lg:order-2">
              <ReplacementOffers offers={offers} />
              <SwapInbox incoming={incomingSwaps} open={openSwaps} />
              <TimeOffSection requests={timeOff} />
            </div>
            <div className="mt-6 min-w-0 lg:order-1 lg:mt-0">
              <PortalSchedule
                shifts={shifts}
                orgName={session.orgName}
                reasonPolicy={reasonPolicy}
                coworkers={coworkers}
              />
            </div>
          </div>
        </div>
      ) : (
        <PortalInactive />
      )}

      <PortalFooter />
    </PortalShell>
  );
}
