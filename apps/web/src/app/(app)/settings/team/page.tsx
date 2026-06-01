import type { Metadata } from "next";

import { getAuthUser } from "@/lib/auth/current-user";
import { getTeam } from "@/lib/team/queries";
import { PageHeader } from "@/components/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { InviteForm } from "@/components/team/invite-form";
import { TeamLists } from "@/components/team/team-lists";

export const metadata: Metadata = { title: "Team" };

export default async function TeamPage() {
  const [user, team] = await Promise.all([getAuthUser(), getTeam()]);

  if (!user || !team.activeOrg) {
    return (
      <>
        <PageHeader title="Team" description="Manage who has access to your workspace." />
        <p className="text-muted-foreground type-body">
          Select or create an organization to manage its team.
        </p>
      </>
    );
  }

  const canManage = team.viewerRole === "owner" || team.viewerRole === "admin";

  return (
    <>
      <PageHeader
        title="Team"
        description={`Manage who has access to ${team.activeOrg.name}.`}
      />

      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle>Invite a teammate</CardTitle>
            <CardDescription>
              They&apos;ll get an email with a link to join. Invites expire in 7 days.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <InviteForm />
          </CardContent>
        </Card>
      ) : null}

      <TeamLists
        members={team.members}
        pendingInvites={team.pendingInvites}
        viewerRole={team.viewerRole}
        currentUserId={user.id}
      />
    </>
  );
}
