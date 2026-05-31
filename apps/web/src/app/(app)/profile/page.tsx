import { User } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { ComingSoon } from "@/components/shell/coming-soon";

export default function ProfilePage() {
  return (
    <>
      <PageHeader
        title="Profile"
        description="Your account details, photo, and preferences."
      />
      <ComingSoon
        icon={User}
        message="Your name, photo, and account preferences will live here. Landing in a later phase."
      />
    </>
  );
}
