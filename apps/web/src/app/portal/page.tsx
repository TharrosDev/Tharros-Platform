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
            className="group mt-8 block rounded-3xl border border-primary/25 bg-gradient-to-br from-primary to-primary/80 p-6 text-primary-foreground shadow-modal outline-none transition-[color,background-color,transform,box-shadow] hover:-translate-y-1 hover:shadow-[0_26px_60px_-30px_color-mix(in_oklch,var(--primary)_80%,transparent)] focus-visible:ring-ring/30 focus-visible:ring-[4px]"
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
              className="group border-primary/20 bg-primary-soft/35 hover:bg-primary-soft/60 focus-visible:ring-ring/30 flex min-h-32 items-center gap-3 rounded-2xl border p-4 shadow-card outline-none transition-[background-color,transform,box-shadow] hover:-translate-y-px hover:shadow-card-hover focus-visible:ring-[4px] lg:items-start lg:p-5"
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
              className="group visual-panel hover:bg-accent/35 focus-visible:ring-ring/30 flex min-h-32 items-center gap-3 rounded-2xl p-4 outline-none transition-[background-color,transform,box-shadow] hover:-translate-y-px hover:shadow-card-hover focus-visible:ring-[4px] lg:items-start lg:p-5"
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
