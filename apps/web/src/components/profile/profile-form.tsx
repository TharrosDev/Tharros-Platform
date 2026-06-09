"use client";

import * as React from "react";
import { useActionState } from "react";
import { Camera } from "lucide-react";

import { setAvatarUrl, updateProfile } from "@/lib/profile/actions";
import { createClient } from "@/lib/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { FieldError, FormMessage } from "@/components/auth/auth-card";
import { useToast } from "@/components/ui/toast";

const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // 2 MB
const AVATAR_TYPES = ["image/png", "image/jpeg", "image/webp"];

export type ProfileDetails = {
  fullName: string;
  email: string;
  initials: string;
  avatarUrl: string | null;
  jobTitle: string;
  bio: string;
  phone: string;
  location: string;
  timezone: string;
};

/** Edit the signed-in user's profile. Email is shown read-only. */
export function ProfileForm({ profile }: { profile: ProfileDetails }) {
  const [state, action, pending] = useActionState(updateProfile, undefined);
  const toast = useToast();
  const lastHandled = React.useRef<typeof state>(null);

  React.useEffect(() => {
    if (state?.ok && state !== lastHandled.current) {
      lastHandled.current = state;
      toast.add({ title: "Profile", description: state.message });
    }
  }, [state, toast]);

  const value = (key: keyof ProfileDetails & string) =>
    state?.values?.[key] ?? (profile[key] as string);

  return (
    <div className="space-y-6">
      <AvatarUploader profile={profile} />

      <form action={action} className="space-y-4" noValidate>
        {state?.message && !state.ok ? <FormMessage>{state.message}</FormMessage> : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="fullName">Name</Label>
            <Input
              id="fullName"
              name="fullName"
              type="text"
              autoComplete="name"
              defaultValue={value("fullName")}
              aria-invalid={Boolean(state?.errors?.fullName)}
              required
            />
            <FieldError message={state?.errors?.fullName?.[0]} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="jobTitle">Job title</Label>
            <Input
              id="jobTitle"
              name="jobTitle"
              type="text"
              autoComplete="organization-title"
              placeholder="e.g. Owner, Office manager"
              defaultValue={value("jobTitle")}
              aria-invalid={Boolean(state?.errors?.jobTitle)}
            />
            <FieldError message={state?.errors?.jobTitle?.[0]} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="bio">About</Label>
          <Textarea
            id="bio"
            name="bio"
            rows={4}
            maxLength={500}
            placeholder="A few words about you and what you do."
            defaultValue={value("bio")}
            aria-invalid={Boolean(state?.errors?.bio)}
          />
          <FieldError message={state?.errors?.bio?.[0]} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              placeholder="e.g. (613) 555-0123"
              defaultValue={value("phone")}
              aria-invalid={Boolean(state?.errors?.phone)}
            />
            <FieldError message={state?.errors?.phone?.[0]} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              name="location"
              type="text"
              placeholder="e.g. Ottawa, ON"
              defaultValue={value("location")}
              aria-invalid={Boolean(state?.errors?.location)}
            />
            <FieldError message={state?.errors?.location?.[0]} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="timezone">Timezone</Label>
            <Input
              id="timezone"
              name="timezone"
              type="text"
              placeholder="e.g. America/Toronto"
              defaultValue={value("timezone")}
              aria-invalid={Boolean(state?.errors?.timezone)}
            />
            <FieldError message={state?.errors?.timezone?.[0]} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={profile.email} disabled readOnly />
            <p className="text-muted-foreground text-sm">
              Your sign-in email. Contact support to change it.
            </p>
          </div>
        </div>

        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </form>
    </div>
  );
}

/**
 * Avatar picker: uploads straight to the public `avatars` bucket (owner-gated
 * by Storage RLS, path `<user_id>/avatar-<ts>.<ext>`), then records the public
 * URL via the `setAvatarUrl` server action so the shell re-renders with it.
 */
function AvatarUploader({ profile }: { profile: ProfileDetails }) {
  const toast = useToast();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [preview, setPreview] = React.useState<string | null>(profile.avatarUrl);
  const [uploading, setUploading] = React.useState(false);

  async function onFile(file: File) {
    if (!AVATAR_TYPES.includes(file.type)) {
      toast.add({ title: "Avatar", description: "Use a PNG, JPEG, or WebP image." });
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      toast.add({ title: "Avatar", description: "Keep the image under 2 MB." });
      return;
    }

    setUploading(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("You must be signed in.");

      const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
      const path = `${user.id}/avatar-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (uploadError) throw new Error(uploadError.message);

      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(path);

      const res = await setAvatarUrl(publicUrl);
      if (res.error) throw new Error(res.error);

      setPreview(publicUrl);
      toast.add({ title: "Avatar", description: "Your photo has been updated." });
    } catch (err) {
      toast.add({
        title: "Couldn't upload avatar",
        description: err instanceof Error ? err.message : "Something went wrong.",
      });
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex items-center gap-4">
      <Avatar className="size-16">
        <AvatarImage src={preview ?? undefined} alt="" />
        <AvatarFallback className="text-lg">{profile.initials}</AvatarFallback>
      </Avatar>
      <div className="space-y-1.5">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          <Camera className="size-4" aria-hidden />
          {uploading ? "Uploading…" : preview ? "Change photo" : "Upload photo"}
        </Button>
        <p className="text-muted-foreground text-xs">PNG, JPEG, or WebP, up to 2 MB.</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={AVATAR_TYPES.join(",")}
        className="sr-only"
        aria-label="Upload profile photo"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void onFile(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}
