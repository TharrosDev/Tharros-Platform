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
    <div className="bg-background min-h-screen lg:grid lg:grid-cols-[1.05fr_0.95fr]">
      <aside className="bg-card relative hidden flex-col justify-between overflow-hidden border-r p-12 lg:flex xl:p-16">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 70% 55% at 85% 0%, color-mix(in oklch, var(--primary) 10%, transparent), transparent 70%)",
          }}
        />

        <Link
          href="/"
          aria-label="Tharros home"
          className=" relative inline-flex min-h-10 w-fit items-center rounded-md "
        >
          <TharrosWordmark markClassName="size-7" />
        </Link>

        <div className="relative max-w-lg">
          <h2 className="text-[clamp(2.5rem,4vw,3.75rem)] leading-[0.95] font-[740] tracking-[-0.05em]">
            Run the business.
            <span className="text-primary-soft-foreground block">Not the busywork.</span>
          </h2>
          <p className="text-muted-foreground mt-5 text-lg leading-relaxed text-pretty">
            Knowledge, scheduling, lead capture and automations in one workspace. AI does the
            groundwork. Your team makes the calls.
          </p>
          <ul className="mt-9 space-y-3">
            {PROMISES.map((item) => (
              <li key={item} className="flex items-center gap-3 text-sm font-medium">
                <span className="bg-primary-soft text-primary-soft-foreground flex size-6 shrink-0 items-center justify-center rounded-md">
                  <Check className="size-3.5" strokeWidth={2.5} aria-hidden />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-muted-foreground type-meta relative">Keep it Local, Keep it Canadian.</p>
      </aside>

      <main className="relative flex min-h-screen flex-col items-center justify-center gap-8 px-4 py-12 sm:px-8 lg:px-12">
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
