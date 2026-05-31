import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getDisplayUser } from "@/lib/auth/user";
import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ToastProvider, Toaster } from "@/components/ui/toast";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Authoritative auth gate: getUser() verifies the JWT with Supabase. The proxy
  // does an optimistic redirect, but this is the check we actually trust.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const displayUser = getDisplayUser(user);

  return (
    <ToastProvider>
      <TooltipProvider>
        <div className="bg-background flex min-h-screen">
          <aside className="bg-sidebar text-sidebar-foreground sticky top-0 hidden h-screen w-64 shrink-0 border-r border-sidebar-border lg:block">
            <Sidebar user={displayUser} />
          </aside>

          <div className="flex min-w-0 flex-1 flex-col">
            <Topbar user={displayUser} />
            <main className="mx-auto w-full max-w-5xl flex-1 space-y-8 px-4 py-8 sm:px-6 sm:py-10">
              {children}
            </main>
          </div>
        </div>
        <Toaster />
      </TooltipProvider>
    </ToastProvider>
  );
}
