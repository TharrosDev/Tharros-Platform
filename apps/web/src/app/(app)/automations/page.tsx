import { Workflow } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { ComingSoon } from "@/components/shell/coming-soon";

export default function AutomationsPage() {
  return (
    <>
      <PageHeader
        title="Automations"
        description="Quietly handles the busywork between the tools you already use."
      />
      <ComingSoon
        icon={Workflow}
        message="Your automation workflows will be built and managed here. Landing in a later phase."
      />
    </>
  );
}
