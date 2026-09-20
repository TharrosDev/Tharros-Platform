import type { Metadata } from "next";

import { getOrgContext } from "@/lib/org/queries";
import { PageHeader } from "@/components/page-header";
import { DangerZone } from "@/components/settings/danger-zone";
import { NoActiveOrg } from "@/components/access-notice";

export const metadata: Metadata = { title: "Danger zone" };

export default async function DangerSettingsPage() {
  const { activeOrg } = await getOrgContext();

  if (!activeOrg) {
    return (
      <>
        <PageHeader title="Danger zone" description="Irreversible account actions." />
        <NoActiveOrg what="delete an organization" />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Danger zone"
        description="Permanent, irreversible actions. Proceed with care."
      />
      <DangerZone orgName={activeOrg.name} isOwner={activeOrg.role === "owner"} />
    </>
  );
}
