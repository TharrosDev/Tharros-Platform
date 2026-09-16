import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { getPortalSession } from "@/lib/portal/session";
import { AvailabilityEntry } from "@/components/portal/availability-entry";
import { buttonVariants } from "@/components/ui/button";
import {
  PortalFooter,
  PortalHeader,
  PortalInactive,
  PortalShell,
} from "@/components/portal/portal-chrome";

export const metadata: Metadata = {
  title: "Your availability",
  // The portal is personal + tokenized — never index it.
  robots: { index: false, follow: false },
};

// The session is read from a cookie + validated against the DB on every load.
export const dynamic = "force-dynamic";

export default async function PortalAvailabilityPage() {
  const session = await getPortalSession();

  return (
    <PortalShell className="lg:max-w-2xl">
      <PortalHeader>
        {session ? (
          <Link href="/portal" className={buttonVariants({ variant: "ghost", size: "sm" })}>
            <ArrowLeft className="size-4" aria-hidden />
            Portal
          </Link>
        ) : null}
      </PortalHeader>

      {session ? (
        <div className="flex flex-1 flex-col">
          <p className="text-muted-foreground type-meta">{session.orgName}</p>
          <h1 className="type-h1 mt-1">Your availability</h1>
          <p className="text-muted-foreground mt-3 mb-8 type-body">
            Tell us when you can work in your own words. We&apos;ll turn it into your weekly
            schedule and only book you inside those times.
          </p>
          <AvailabilityEntry employeeName={session.employeeName} />
        </div>
      ) : (
        <PortalInactive />
      )}

      <PortalFooter />
    </PortalShell>
  );
}
