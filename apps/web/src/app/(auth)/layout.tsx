import { redirect } from "next/navigation";

import { getAuthUser } from "@/lib/auth/current-user";
import { TharrosWordmark } from "@/components/brand/logo";

/**
 * Layout for the unauthenticated auth screens. A split: a warm-graphite brand
 * panel on the left (desktop), the form card on the clean canvas to the right.
 * On mobile it collapses to a single centered column with the wordmark on top.
 * Already-signed-in users are bounced back into the app.
 */
export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getAuthUser();
  if (user) redirect("/dashboard");

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[1.05fr_1fr]">
      {/* Brand panel — desktop only */}
      <aside className="bg-sidebar text-sidebar-foreground relative hidden flex-col justify-between overflow-hidden p-12 lg:flex">
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

        <TharrosWordmark markClassName="size-7" className="relative" />

        <div className="relative max-w-md">
          <h2 className="text-3xl font-bold leading-tight tracking-tight text-balance">
            The operating layer your business runs on.
          </h2>
          <p className="text-sidebar-muted-foreground mt-4 text-base leading-relaxed text-pretty">
            Tharros quietly handles the busywork between your tools and surfaces
            only what actually needs you. Sign in to see what was handled.
          </p>
        </div>

        <p className="text-sidebar-muted-foreground relative type-meta">
          Local and Canadian
        </p>
      </aside>

      {/* Form side */}
      <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-4 py-12">
        <TharrosWordmark markClassName="size-7" className="lg:hidden" />
        {children}
      </main>
    </div>
  );
}
