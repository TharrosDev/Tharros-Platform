import { Settings } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { ComingSoon } from "@/components/shell/coming-soon";

export default function SettingsPage() {
  return (
    <>
      <PageHeader
        title="Settings"
        description="Manage your workspace, connectors, and team."
      />
      <ComingSoon
        icon={Settings}
        message="Workspace and connector settings will live here. Landing in a later phase."
      />
    </>
  );
}
