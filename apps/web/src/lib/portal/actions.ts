"use server";

import { redirect } from "next/navigation";

import { clearPortalCookie } from "@/lib/portal/session";

/** Sign out of the employee portal: clear the cookie and return to the entry state. */
export async function signOutPortal(): Promise<void> {
  await clearPortalCookie();
  redirect("/portal");
}
