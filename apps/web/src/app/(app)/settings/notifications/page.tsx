import type { Metadata } from "next";

import { getOrgContext, getOrgSettings } from "@/lib/org/queries";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NotificationsForm } from "@/components/org/notifications-form";
import { NOTIFICATION_DEFAULTS } from "@/lib/org/schemas";
import { NoActiveOrg } from "@/components/access-notice";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsSettingsPage() {
  const [{ activeOrg }, settings] = await Promise.all([getOrgContext(), getOrgSettings()]);

  if (!activeOrg) {
    return (
      <>
        <PageHeader title="Notifications" description="Workspace email preferences." />
        <NoActiveOrg what="set notification preferences" />
      </>
    );
  }

  const canManage = activeOrg.role === "owner" || activeOrg.role === "admin";

  return (
    <>
      <PageHeader title="Notifications" description={`Which emails ${activeOrg.name} sends.`} />

      <Card>
        <CardHeader>
          <CardTitle>Email preferences</CardTitle>
          <CardDescription>
            {canManage
              ? "These apply to everyone in this workspace."
              : "Only owners and admins can change these."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NotificationsForm
            defaults={settings?.notifications ?? NOTIFICATION_DEFAULTS}
            canManage={canManage}
          />
        </CardContent>
      </Card>
    </>
  );
}
