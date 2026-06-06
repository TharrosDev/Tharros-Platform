import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, ChevronRight, Clock, Plane } from "lucide-react";

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

const COMING_SOON = [
  {
    icon: CalendarDays,
    title: "Your schedule",
    body: "See your shifts for the next two weeks, with add-to-calendar.",
  },
  {
    icon: Plane,
    title: "Time off & swaps",
    body: "Request time off, pick up open shifts, and swap with teammates.",
  },
];

export default async function PortalPage() {
  const session = await getPortalSession();

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
          <p className="text-muted-foreground type-meta">{session.orgName}</p>
          <h1 className="type-h1 mt-1">Hi {session.employeeName}</h1>
          <p className="text-muted-foreground mt-3 type-body">
            This is your personal portal for {session.orgName}. Set your availability below; more
            scheduling tools arrive soon.
          </p>

          <Link
            href="/portal/availability"
            className="group border-primary/30 bg-primary-soft/40 hover:bg-primary-soft/70 mt-8 flex items-center gap-3 rounded-xl border p-4 transition-colors"
          >
            <span className="bg-primary text-primary-foreground flex size-9 shrink-0 items-center justify-center rounded-lg">
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

          <ul className="mt-3 flex flex-col gap-3">
            {COMING_SOON.map(({ icon: Icon, title, body }) => (
              <li
                key={title}
                className="border-border bg-card flex items-start gap-3 rounded-xl border p-4"
              >
                <span className="bg-primary-soft text-primary-soft-foreground mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg">
                  <Icon className="size-4.5" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="text-foreground font-medium">{title}</p>
                  <p className="text-muted-foreground text-sm">{body}</p>
                  <p className="text-muted-foreground/80 mt-1 text-xs font-medium">Coming soon</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <h1 className="type-h2">This link isn&apos;t active</h1>
          <p className="text-muted-foreground mt-3 max-w-xs type-body">
            Your portal link may have expired or been replaced. Ask your manager to send you
            a fresh link, then open it from your email.
          </p>
        </div>
      )}

      <footer className="text-muted-foreground/70 mt-10 pt-6 text-center text-xs">
        Powered by Tharros
      </footer>
    </main>
  );
}
