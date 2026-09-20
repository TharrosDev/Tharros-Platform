import { redirect } from "next/navigation";
import Link from "next/link";
import { Check } from "lucide-react";

import { getAuthUser } from "@/lib/auth/current-user";
import { TharrosWordmark } from "@/components/brand/logo";

const PROMISES = [
  "Answers cite your own documents",
  "Schedules are reviewed before they're published",
  "Follow-ups are drafted, never sent without you",
];

/**
 * Layout for the unauthenticated auth screens. A split: the light brand panel
 * (desktop) carries the same proposition as the marketing site; the form sits
 * on the canvas to the right. On mobile it collapses to one centered column
 * with the wordmark on top. Already-signed-in users are bounced into the app.
 */
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const user = await getAuthUser();
  if (user) redirect("/dashboard");

  return (
    <div className="bg-background min-h-dvh lg:grid lg:grid-cols-[1.05fr_0.95fr]">
      <aside className="on-rack seam-r relative hidden flex-col justify-between overflow-hidden p-12 lg:flex xl:p-16">
        <Link
          href="/"
          aria-label="Tharros home"
          className=" relative inline-flex min-h-10 w-fit items-center rounded-md "
        >
          <TharrosWordmark markClassName="size-7" />
        </Link>

        <div className="relative max-w-lg">
          <h2 className="type-display">
            Run the business.
            <span className="text-primary block">Not the busywork.</span>
          </h2>
          <p className="text-rack-muted-foreground type-body mt-5 text-pretty sm:text-lg">
            Knowledge, scheduling, lead capture and automations in one workspace. AI does the
            groundwork. Your team makes the calls.
          </p>
          <ul className="mt-9 space-y-3">
            {PROMISES.map((item) => (
              <li
                key={item}
                className="type-meta text-rack-muted-foreground flex items-center gap-3"
              >
                <span className="border-primary-edge bg-primary text-primary-foreground flex size-5 shrink-0 items-center justify-center border">
                  <Check className="size-3.5" strokeWidth={2.5} aria-hidden />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-rack-muted-foreground type-meta relative">
          Keep it Local, Keep it Canadian.
        </p>
      </aside>

      <main className="relative flex min-h-dvh flex-col lg:items-center lg:justify-center lg:gap-8 lg:px-12 lg:py-12">
        {/* The rack, carried to mobile so the form is seated in something. */}
        <div className="on-rack seam-b px-5 py-6 lg:hidden">
          <Link
            href="/"
            aria-label="Tharros home"
            className="min-h-control inline-flex items-center"
          >
            <TharrosWordmark markClassName="size-6" />
          </Link>
          <p className="type-h2 text-rack-foreground mt-4">
            Run the business.
            <span className="text-primary block">Not the busywork.</span>
          </p>
          <ul className="mt-4 space-y-1.5">
            {PROMISES.map((item) => (
              <li
                key={item}
                className="type-meta text-rack-muted-foreground flex items-center gap-2.5"
              >
                <span aria-hidden className="bg-primary h-px w-3" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-1 flex-col justify-start gap-8 px-4 py-10 sm:px-8 lg:w-full lg:flex-none lg:justify-center lg:p-0">
          {children}
        </div>
      </main>
    </div>
  );
}
