import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, ChevronRight, Clock } from "lucide-react";

import { getPortalSession } from "@/lib/portal/session";
import { signOutPortal } from "@/lib/portal/actions";
import { TharrosWordmark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Employee portal",
  // The portal is personal + tokenized — never index it.
  robots: { index: false, follow: false },
};

// The session is read from a cookie + validated against the DB on every load.
export const dynamic = "force-dynamic";

export default async function PortalPage() {
  const session = await getPortalSession();

  return (
    <main className="bg-background mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 py-8 lg:max-w-3xl lg:px-8 lg:py-12">
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
          <p className="text-muted-foreground type-meta">{session.orgName}</p>
          <h1 className="type-h1 mt-1">Hi {session.employeeName}</h1>
          <p className="text-muted-foreground mt-3 type-body">
            This is your personal portal for {session.orgName}. See your schedule and set your
            availability below.
          </p>

          <div className="mt-8 grid gap-3 lg:grid-cols-2 lg:gap-4">
          <Link
            href="/portal/schedule"
            className="group border-primary/30 bg-primary-soft/40 hover:bg-primary-soft/70 flex items-center gap-3 rounded-xl border p-4 transition-colors lg:items-start lg:p-5"
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
            className="group border-border bg-card hover:bg-accent/40 flex items-center gap-3 rounded-xl border p-4 transition-colors lg:items-start lg:p-5"
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
