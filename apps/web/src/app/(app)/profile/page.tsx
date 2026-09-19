import type { Metadata } from "next";

import { getAuthUser } from "@/lib/auth/current-user";
import { getDisplayUser } from "@/lib/auth/user";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ProfileForm, type ProfileDetails } from "@/components/profile/profile-form";

export const metadata: Metadata = { title: "Profile" };

type ProfileRow = {
  full_name: string | null;
  avatar_url: string | null;
  job_title: string | null;
  bio: string | null;
  phone: string | null;
  location: string | null;
  timezone: string | null;
};

export default async function ProfilePage() {
  const user = await getAuthUser();
  if (!user) return null; // (app) layout already gates this; satisfies the type.

  const display = getDisplayUser(user);

  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("full_name, avatar_url, job_title, bio, phone, location, timezone")
    .eq("id", user.id)
    .maybeSingle<ProfileRow>();

  const profile: ProfileDetails = {
    fullName: data?.full_name ?? display.name,
    email: display.email,
    initials: display.initials,
    avatarUrl: data?.avatar_url ?? null,
    jobTitle: data?.job_title ?? "",
    bio: data?.bio ?? "",
    phone: data?.phone ?? "",
    location: data?.location ?? "",
    timezone: data?.timezone ?? "",
  };

  return (
    <>
      <PageHeader
        title="Profile"
        description="Your photo, details, and how your name appears across Tharros."
      />

      <Card className="visual-panel-strong max-w-2xl">
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>
            Your photo and name show on your workspace; the rest is for your team.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm profile={profile} />
        </CardContent>
      </Card>
    </>
  );
}
