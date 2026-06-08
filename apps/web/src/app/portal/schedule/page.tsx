import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { getPortalSession } from "@/lib/portal/session";
import { getPortalSchedule } from "@/lib/portal/schedule";
import { signOutPortal } from "@/lib/portal/actions";
import { TharrosWordmark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { PortalSchedule } from "@/components/portal/portal-schedule";

export const metadata: Metadata = {
  title: "My schedule",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function PortalSchedulePage() {
  const session = await getPortalSession();
  const shifts = session ? await getPortalSchedule(session.employeeId, session.orgId) : [];

  return (
    <main className="bg-background mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 py-8">
      <header className="mb-8 flex items-center justify-between">
        <TharrosWordmark />
        {session ? (
          <form action={signOutPortal}>
            <Button type="submit" variant="ghost" size="sm">
              Sign out
            </Button>
          </form>
        ) : null}
      </header>

      {session ? (
        <div className="flex flex-1 flex-col">
          <Link
            href="/portal"
            className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm"
          >
            <ChevronLeft className="size-4" /> Portal
          </Link>
          <p className="text-muted-foreground type-meta">{session.orgName}</p>
          <h1 className="type-h1 mt-1">Your schedule</h1>
          <p className="text-muted-foreground mt-2 type-body">Your shifts for the next two weeks.</p>

          <div className="mt-6">
            <PortalSchedule shifts={shifts} orgName={session.orgName} />
          </div>
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <h1 className="type-h2">This link isn&apos;t active</h1>
          <p className="text-muted-foreground mt-3 max-w-xs type-body">
            Your portal link may have expired or been replaced. Ask your manager to send you a fresh
            link, then open it from your email.
          </p>
        </div>
      )}

      <footer className="text-muted-foreground/70 mt-10 pt-6 text-center text-xs">
        Powered by Tharros
      </footer>
    </main>
  );
}
