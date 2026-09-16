import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CalendarDays, ChevronRight, Clock } from "lucide-react";

import { getPortalSession } from "@/lib/portal/session";
import { signOutPortal } from "@/lib/portal/actions";
import { getPortalSchedule, type PortalShift } from "@/lib/portal/schedule";
import { Button } from "@/components/ui/button";
import {
  PortalFooter,
  PortalHeader,
  PortalInactive,
  PortalShell,
} from "@/components/portal/portal-chrome";

const fmtNextDay = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});
const fmtNextTime = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: "UTC",
});

function nextShiftLabel(shift: PortalShift): string {
  const start = new Date(Date.parse(shift.startsAt));
  const end = new Date(Date.parse(shift.endsAt));
  return `${fmtNextDay.format(start)} · ${fmtNextTime.format(start)} – ${fmtNextTime.format(end)}`;
}

export const metadata: Metadata = {
  title: "Employee portal",
  // The portal is personal + tokenized — never index it.
  robots: { index: false, follow: false },
};

// The session is read from a cookie + validated against the DB on every load.
export const dynamic = "force-dynamic";

export default async function PortalPage() {
  const session = await getPortalSession();
  const nextShift = session
    ? ((await getPortalSchedule(session.employeeId, session.orgId))[0] ?? null)
    : null;

  return (
    <PortalShell className="lg:max-w-4xl">
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
          <p className="text-muted-foreground type-meta">{session.orgName}</p>
          <h1 className="type-h1 mt-1">Hi {session.employeeName}</h1>
          <p className="text-muted-foreground mt-3 type-body">
            This is your personal portal for {session.orgName}. See your schedule and set your
            availability below.
          </p>

          {/* The one thing most visits are about: when do I work next. */}
          <Link
            href="/portal/schedule"
            className="group bg-primary text-primary-foreground shadow-raised hover:-translate-y-0.5 hover:bg-primary/90 focus-visible:ring-ring/40 mt-8 block rounded-xl p-6 outline-none transition-[color,background-color,transform] focus-visible:ring-[3px]"
          >
            <p className="type-meta text-primary-foreground/80">Your next shift</p>
            {nextShift ? (
              <>
                <p className="mt-1.5 text-xl font-bold tracking-tight tabular-nums">
                  {nextShiftLabel(nextShift)}
                </p>
                {nextShift.roleName ? (
                  <p className="text-primary-foreground/85 mt-0.5 text-sm">{nextShift.roleName}</p>
                ) : null}
              </>
            ) : (
              <p className="mt-1.5 text-xl font-bold tracking-tight">Nothing scheduled yet</p>
            )}
            <span className="text-primary-foreground/90 mt-3 inline-flex items-center gap-1 text-sm font-medium">
              {nextShift ? "See your full schedule" : "Open your schedule"}
              <ArrowRight className="size-4 transition-transform duration-150 ease-out group-hover:translate-x-0.5" />
            </span>
          </Link>

          <div className="mt-4 grid gap-3 lg:grid-cols-2 lg:gap-4">
            <Link
              href="/portal/schedule"
              className="group border-primary/30 bg-primary-soft/40 hover:bg-primary-soft/70 focus-visible:ring-ring/40 flex min-h-32 items-center gap-3 rounded-xl border p-4 outline-none transition-colors focus-visible:ring-[3px] lg:items-start lg:p-5"
            >
              <span className="bg-primary text-primary-foreground flex size-9 shrink-0 items-center justify-center rounded-lg">
                <CalendarDays className="size-4.5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-foreground font-medium">Your schedule</p>
                <p className="text-muted-foreground text-sm">
                  See your shifts, request time off, swap shifts, and add them to your calendar.
                </p>
              </div>
              <ChevronRight
                className="text-muted-foreground group-hover:text-foreground size-5 shrink-0 transition-colors"
                aria-hidden
              />
            </Link>

            <Link
              href="/portal/availability"
              className="group border-border bg-card hover:bg-accent/40 focus-visible:ring-ring/40 flex min-h-32 items-center gap-3 rounded-xl border p-4 outline-none transition-colors focus-visible:ring-[3px] lg:items-start lg:p-5"
            >
              <span className="bg-primary-soft text-primary-soft-foreground flex size-9 shrink-0 items-center justify-center rounded-lg">
                <Clock className="size-4.5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-foreground font-medium">Set your availability</p>
                <p className="text-muted-foreground text-sm">
                  Tell us when you can work, in plain language.
                </p>
              </div>
              <ChevronRight
                className="text-muted-foreground group-hover:text-foreground size-5 shrink-0 transition-colors"
                aria-hidden
              />
            </Link>
          </div>
        </div>
      ) : (
        <PortalInactive />
      )}

      <PortalFooter />
    </PortalShell>
  );
}
