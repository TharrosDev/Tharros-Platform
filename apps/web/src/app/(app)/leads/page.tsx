import { Users } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { ComingSoon } from "@/components/shell/coming-soon";

export default function LeadsPage() {
  return (
    <>
      <PageHeader
        title="Lead Capture"
        description="Catches every enquiry and follows up so none slip away."
      />
      <ComingSoon
        icon={Users}
        message="Captured leads and their AI follow-ups will show up here. Landing in a later phase."
      />
    </>
  );
}
