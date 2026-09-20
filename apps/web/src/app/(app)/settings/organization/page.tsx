import type { Metadata } from "next";

import { getOrgContext } from "@/lib/org/queries";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormMessage } from "@/components/auth/auth-card";
import { OrgSettingsForm } from "@/components/org/org-settings-form";
import { NoActiveOrg } from "@/components/access-notice";

export const metadata: Metadata = { title: "Business profile" };

export default async function OrganizationSettingsPage() {
  const { activeOrg } = await getOrgContext();

  if (!activeOrg) {
    return (
      <>
        <PageHeader title="Business profile" description="Your business details." />
        <NoActiveOrg what="edit a business profile" />
      </>
    );
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("organizations")
    .select("name, industry, size")
    .eq("id", activeOrg.id)
    .single();
  const org = data as { name: string; industry: string | null; size: string | null } | null;

  const isOwner = activeOrg.role === "owner";
  const defaults = {
    name: org?.name ?? activeOrg.name,
    industry: org?.industry ?? "",
    size: org?.size ?? "",
  };

  return (
    <>
      <PageHeader
        title="Business profile"
        description="How your business is described across Tharros."
      />

      <Card>
        <CardHeader>
          <CardTitle>{activeOrg.name}</CardTitle>
          <CardDescription>Name, industry, and team size.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isOwner ? (
            <OrgSettingsForm defaults={defaults} />
          ) : (
            <>
              <FormMessage tone="error">
                Only the organization owner can edit these details.
              </FormMessage>
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-muted-foreground">Business name</dt>
                  <dd className="text-foreground font-medium">{defaults.name}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Industry</dt>
                  <dd className="text-foreground font-medium">{defaults.industry || "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Team size</dt>
                  <dd className="text-foreground font-medium">{defaults.size || "—"}</dd>
                </div>
              </dl>
            </>
          )}
        </CardContent>
      </Card>
    </>
  );
}
