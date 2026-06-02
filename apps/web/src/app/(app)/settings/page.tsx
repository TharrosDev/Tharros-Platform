import { redirect } from "next/navigation";

// Settings is a sectioned area with a persistent rail (see settings/layout.tsx).
// The index lands on the first section.
export default function SettingsPage() {
  redirect("/settings/organization");
}
