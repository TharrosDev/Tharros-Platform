import * as React from "react";
import Link from "next/link";
import { Link2Off } from "lucide-react";

import { cn } from "@/lib/utils";
import { TharrosWordmark } from "@/components/brand/logo";
import { EmptyState } from "@/components/ui/empty-state";

function PortalShell({ className, children }: React.ComponentProps<"main">) {
  return (
    <main
      className={cn(
        "app-shell-canvas mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 py-5 sm:px-6 sm:py-7 lg:px-8 lg:py-9",
        className,
      )}
    >
      {children}
    </main>
  );
}

function PortalHeader({ children }: { children?: React.ReactNode }) {
  return (
    <header className="visual-panel mb-8 flex min-h-14 items-center justify-between gap-4 rounded-2xl px-4 py-3">
      <Link
        href="/portal"
        aria-label="Employee portal home"
        className="focus-visible:ring-ring/30 rounded-xl outline-none focus-visible:ring-[4px]"
      >
        <TharrosWordmark />
      </Link>
      {children}
    </header>
  );
}

function PortalInactive() {
  return (
    <EmptyState
      icon={<Link2Off />}
      title="This link isn’t active"
      description="Your portal link may have expired or been replaced. Ask your manager to send you a fresh link, then open it from your email."
      headingLevel="h1"
      className="my-auto"
    />
  );
}

function PortalFooter() {
  return (
    <footer className="text-muted-foreground/70 border-border/70 mt-10 border-t pt-6 text-center text-xs">
      Powered by Tharros
    </footer>
  );
}

export { PortalFooter, PortalHeader, PortalInactive, PortalShell };
