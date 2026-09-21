"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getAuthUser } from "@/lib/auth/current-user";
import { getSubscription } from "@/lib/billing/entitlements";
import { logger } from "@/lib/observability/logger";
import { getOrgContext } from "@/lib/org/queries";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Enterprise admin actions: locations, member ↔ location assignment, knowledge
 * collections and retention. Every action requires an owner/admin on the
 * Enterprise tier; writes use the service role (clients have no write grant
 * on these tables) and are always scoped to the caller's active org.
 */

async function requireEnterpriseAdmin() {
  const [user, { activeOrg }, sub] = await Promise.all([
    getAuthUser(),
    getOrgContext(),
    getSubscription(),
  ]);
  if (!user || !activeOrg) throw new Error("Not signed in.");
  if (activeOrg.role !== "owner" && activeOrg.role !== "admin") {
    throw new Error("Only owners and admins can manage this.");
  }
  if (sub?.tier !== "enterprise") throw new Error("This needs the Enterprise plan.");
  return { orgId: activeOrg.id, admin: createAdminClient() };
}

const name = z.string().trim().min(1).max(120);
const uuid = z.string().uuid();

async function run(
  label: string,
  fn: () => PromiseLike<{ error: unknown } | void>,
  paths: string[],
): Promise<void> {
  try {
    const res = await fn();
    if (res && res.error) logger.warn(`enterprise.${label}_failed`, { err: res.error });
  } catch (err) {
    logger.warn(`enterprise.${label}_rejected`, { err });
  }
  for (const p of paths) revalidatePath(p);
}

/** Confirm a row with this id belongs to the org before linking to it. */
async function inOrg(
  admin: ReturnType<typeof createAdminClient>,
  table: string,
  orgId: string,
  id: string,
) {
  const { data } = await admin
    .from(table)
    .select("id")
    .eq("org_id", orgId)
    .eq("id", id)
    .maybeSingle();
  if (!data) throw new Error(`${table} row not in this organization.`);
}

export async function createLocation(formData: FormData): Promise<void> {
  await run(
    "create_location",
    async () => {
      const { orgId, admin } = await requireEnterpriseAdmin();
      return admin
        .from("locations")
        .insert({ org_id: orgId, name: name.parse(formData.get("name")) });
    },
    ["/settings/enterprise"],
  );
}

export async function deleteLocation(formData: FormData): Promise<void> {
  await run(
    "delete_location",
    async () => {
      const { orgId, admin } = await requireEnterpriseAdmin();
      return admin
        .from("locations")
        .delete()
        .eq("id", uuid.parse(formData.get("id")))
        .eq("org_id", orgId);
    },
    ["/settings/enterprise", "/knowledge"],
  );
}

export async function assignMemberLocation(formData: FormData): Promise<void> {
  await run(
    "assign_location",
    async () => {
      const { orgId, admin } = await requireEnterpriseAdmin();
      const userId = uuid.parse(formData.get("userId"));
      const locationId = uuid.parse(formData.get("locationId"));
      const { data: member } = await admin
        .from("memberships")
        .select("user_id")
        .eq("org_id", orgId)
        .eq("user_id", userId)
        .maybeSingle();
      if (!member) throw new Error("Member not in this organization.");
      await inOrg(admin, "locations", orgId, locationId);
      return admin
        .from("membership_locations")
        .upsert({ org_id: orgId, user_id: userId, location_id: locationId });
    },
    ["/settings/enterprise"],
  );
}

export async function unassignMemberLocation(formData: FormData): Promise<void> {
  await run(
    "unassign_location",
    async () => {
      const { orgId, admin } = await requireEnterpriseAdmin();
      return admin
        .from("membership_locations")
        .delete()
        .eq("org_id", orgId)
        .eq("user_id", uuid.parse(formData.get("userId")))
        .eq("location_id", uuid.parse(formData.get("locationId")));
    },
    ["/settings/enterprise"],
  );
}

export async function createCollection(formData: FormData): Promise<void> {
  await run(
    "create_collection",
    async () => {
      const { orgId, admin } = await requireEnterpriseAdmin();
      const locationId = String(formData.get("locationId") ?? "");
      if (locationId) await inOrg(admin, "locations", orgId, uuid.parse(locationId));
      return admin.from("knowledge_collections").insert({
        org_id: orgId,
        name: name.parse(formData.get("name")),
        location_id: locationId || null,
        min_role: z.enum(["member", "admin", "owner"]).parse(formData.get("minRole") ?? "member"),
      });
    },
    ["/knowledge"],
  );
}

export async function deleteCollection(formData: FormData): Promise<void> {
  await run(
    "delete_collection",
    async () => {
      const { orgId, admin } = await requireEnterpriseAdmin();
      // Its documents fall back to unrestricted (on delete set null).
      return admin
        .from("knowledge_collections")
        .delete()
        .eq("id", uuid.parse(formData.get("id")))
        .eq("org_id", orgId);
    },
    ["/knowledge"],
  );
}

export async function setDocumentCollection(formData: FormData): Promise<void> {
  await run(
    "set_document_collection",
    async () => {
      const { orgId, admin } = await requireEnterpriseAdmin();
      const collectionId = String(formData.get("collectionId") ?? "");
      if (collectionId)
        await inOrg(admin, "knowledge_collections", orgId, uuid.parse(collectionId));
      return admin
        .from("documents")
        .update({ collection_id: collectionId || null })
        .eq("id", uuid.parse(formData.get("documentId")))
        .eq("org_id", orgId);
    },
    ["/knowledge"],
  );
}

export async function setRetentionDays(formData: FormData): Promise<void> {
  await run(
    "set_retention",
    async () => {
      const { orgId, admin } = await requireEnterpriseAdmin();
      const raw = String(formData.get("days") ?? "").trim();
      const days = raw ? z.coerce.number().int().min(1).max(3650).parse(raw) : null;
      return admin
        .from("org_settings")
        .update({ assistant_retention_days: days })
        .eq("org_id", orgId);
    },
    ["/settings/enterprise"],
  );
}
