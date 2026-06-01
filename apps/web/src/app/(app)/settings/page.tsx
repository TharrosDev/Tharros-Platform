import Link from "next/link";
import { Settings, Users, ChevronRight } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { ComingSoon } from "@/components/shell/coming-soon";

export default function SettingsPage() {
  return (
    <>
      <PageHeader
        title="Settings"
        description="Manage your workspace, connectors, and team."
      />

      <Link
        href="/settings/team"
        className="bg-card shadow-card hover:bg-muted/40 focus-visible:ring-ring/40 flex items-center gap-4 rounded-lg border border-border p-4 transition-colors outline-none focus-visible:ring-[3px]"
      >
        <span className="bg-primary-soft text-primary-soft-foreground flex size-10 shrink-0 items-center justify-center rounded-md">
          <Users className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="text-foreground block font-medium">Team</span>
          <span className="text-muted-foreground block text-sm">
            Invite teammates, assign roles, and manage access.
          </span>
        </span>
        <ChevronRight className="text-muted-foreground size-5 shrink-0" />
      </Link>

      <ComingSoon
        icon={Settings}
        message="Workspace and connector settings will live here. Landing in a later phase."
      />
    </>
  );
}
