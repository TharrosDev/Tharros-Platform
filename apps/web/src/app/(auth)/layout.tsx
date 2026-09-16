import { redirect } from "next/navigation";
import Link from "next/link";
import { Check } from "lucide-react";

import { getAuthUser } from "@/lib/auth/current-user";
import { TharrosWordmark } from "@/components/brand/logo";

/**
 * Layout for the unauthenticated auth screens. A split: a warm-graphite brand
 * panel on the left (desktop), the form card on the clean canvas to the right.
 * On mobile it collapses to a single centered column with the wordmark on top.
 * Already-signed-in users are bounced back into the app.
 */
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const user = await getAuthUser();
  if (user) redirect("/dashboard");

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[1.05fr_1fr]">
      {/* Brand panel — desktop only */}
      <aside className="bg-sidebar text-sidebar-foreground relative hidden flex-col justify-between overflow-hidden p-12 xl:p-16 lg:flex">
        <div
          aria-hidden
          className="text-sidebar-foreground pointer-events-none absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage: "radial-gradient(currentColor 1px, transparent 1px)",
            backgroundSize: "22px 22px",
          }}
        />
        <div
          aria-hidden
          className="bg-primary pointer-events-none absolute -top-24 -right-24 size-80 rounded-full opacity-20 blur-3xl"
        />

        <Link
          href="/"
          aria-label="Tharros home"
          className="focus-visible:ring-sidebar-ring/50 relative inline-flex min-h-10 w-fit items-center rounded-md outline-none focus-visible:ring-[3px]"
        >
          <TharrosWordmark markClassName="size-7" />
        </Link>

        <div className="relative max-w-md">
          <h2 className="text-3xl font-bold leading-tight tracking-tight text-balance">
            The operating layer your business runs on.
          </h2>
          <p className="text-sidebar-muted-foreground mt-4 text-base leading-relaxed text-pretty">
            Tharros quietly handles the busywork between your tools and surfaces only what actually
            needs you. Sign in to see what was handled.
          </p>
          <ul className="mt-8 space-y-3">
            {[
              "Answers grounded in your business",
              "Schedules built around real constraints",
              "Exceptions gathered in one place",
            ].map((item) => (
              <li key={item} className="flex items-center gap-3 text-sm font-medium">
                <span className="bg-primary/20 text-primary-soft-foreground flex size-6 items-center justify-center rounded-md">
                  <Check className="size-3.5" strokeWidth={2.5} aria-hidden />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-sidebar-muted-foreground relative type-meta">Local and Canadian</p>
      </aside>

      {/* Form side */}
      <main className="app-shell-canvas flex min-h-screen flex-col items-center justify-center gap-8 px-4 py-12 sm:px-8">
        <Link
          href="/"
          aria-label="Tharros home"
          className="focus-visible:ring-ring/40 inline-flex min-h-10 items-center rounded-md outline-none focus-visible:ring-[3px] lg:hidden"
        >
          <TharrosWordmark markClassName="size-7" />
        </Link>
        {children}
      </main>
    </div>
  );
}
