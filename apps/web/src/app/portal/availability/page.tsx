import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { getPortalSession } from "@/lib/portal/session";
import { AvailabilityEntry } from "@/components/portal/availability-entry";
import { TharrosWordmark } from "@/components/brand/logo";
import { buttonVariants } from "@/components/ui/button";

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
    <main className="bg-background mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 py-8">
      <header className="mb-8 flex items-center justify-between">
        <TharrosWordmark />
        {session ? (
          <Link href="/portal" className={buttonVariants({ variant: "ghost", size: "sm" })}>
            <ArrowLeft className="size-4" aria-hidden />
            Portal
          </Link>
        ) : null}
      </header>

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
