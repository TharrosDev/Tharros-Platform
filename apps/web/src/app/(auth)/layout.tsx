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

      <main className="relative flex min-h-dvh flex-col items-center justify-center gap-8 px-4 py-12 sm:px-8 lg:px-12">
        <Link
          href="/"
          aria-label="Tharros home"
          className=" inline-flex min-h-10 items-center rounded-md lg:hidden"
        >
          <TharrosWordmark markClassName="size-7" />
        </Link>
        {children}
      </main>
    </div>
  );
}
