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
    <div className="min-h-screen lg:grid lg:grid-cols-[1.12fr_0.88fr]">
      {/* Brand panel — desktop only */}
      <aside className="bg-sidebar text-sidebar-foreground relative hidden flex-col justify-between overflow-hidden border-r border-sidebar-border p-12 shadow-[28px_0_80px_-55px_rgba(0,0,0,0.9)] xl:p-16 lg:flex">
        <div
          aria-hidden
          className="text-sidebar-foreground pointer-events-none absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              "linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)",
            backgroundSize: "44px 44px",
            maskImage: "linear-gradient(to bottom, black, transparent 82%)",
          }}
        />
        <div
          aria-hidden
          className="bg-primary pointer-events-none absolute -top-40 -right-32 size-[34rem] rounded-full opacity-25 blur-[110px]"
        />

        <Link
          href="/"
          aria-label="Tharros home"
          className="focus-visible:ring-sidebar-ring/50 relative inline-flex min-h-10 w-fit items-center rounded-md outline-none focus-visible:ring-[3px]"
        >
          <TharrosWordmark markClassName="size-7" />
        </Link>

        <div className="relative max-w-xl">
          <span className="type-meta text-primary">Tharros operating system</span>
          <h2 className="mt-4 text-4xl font-bold leading-[1.02] tracking-[-0.045em] text-balance xl:text-5xl">
            The operating layer your business runs on.
          </h2>
          <p className="text-sidebar-muted-foreground mt-4 text-base leading-relaxed text-pretty">
            Tharros quietly handles the busywork between your tools and surfaces only what actually
            needs you. Sign in to see what was handled.
          </p>
          <ul className="mt-10 grid gap-3 sm:grid-cols-1">
            {[
              "Answers grounded in your business",
              "Schedules built around real constraints",
              "Exceptions gathered in one place",
            ].map((item) => (
              <li key={item} className="flex items-center gap-3 text-sm font-medium">
                <span className="bg-primary/20 text-primary-soft-foreground flex size-7 items-center justify-center rounded-lg border border-primary/20 shadow-[0_0_22px_-8px_rgba(90,110,255,0.9)]">
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
      <main className="app-shell-canvas relative flex min-h-screen flex-col items-center justify-center gap-8 px-4 py-12 sm:px-8 lg:px-12">
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
