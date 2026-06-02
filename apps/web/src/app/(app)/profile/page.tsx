import type { Metadata } from "next";

import { getAuthUser } from "@/lib/auth/current-user";
import { getDisplayUser } from "@/lib/auth/user";
import { PageHeader } from "@/components/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ProfileForm } from "@/components/profile/profile-form";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  const user = await getAuthUser();
  if (!user) return null; // (app) layout already gates this; satisfies the type.

  const display = getDisplayUser(user);

  return (
    <>
      <PageHeader
        title="Profile"
        description="Your account details and how your name appears across Tharros."
      />

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>Update your name. This shows on your workspace.</CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm fullName={display.name} email={display.email} />
        </CardContent>
      </Card>
    </>
  );
}
