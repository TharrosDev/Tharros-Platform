import "server-only";

import { createClient } from "@/lib/supabase/server";

export type Location = { id: string; name: string };
export type Collection = {
  id: string;
  name: string;
  locationId: string | null;
  minRole: "member" | "admin" | "owner";
};

/** Locations, member assignments and retention for the org (RLS-scoped reads). */
export async function getEnterpriseSettings(orgId: string) {
  const supabase = await createClient();
  const [{ data: locations }, { data: assignments }, { data: settings }] = await Promise.all([
    supabase.from("locations").select("id, name").eq("org_id", orgId).order("name"),
    supabase.from("membership_locations").select("user_id, location_id").eq("org_id", orgId),
    supabase
      .from("org_settings")
      .select("assistant_retention_days")
      .eq("org_id", orgId)
      .maybeSingle(),
  ]);
  return {
    locations: (locations ?? []) as Location[],
    assignments: (assignments ?? []) as { user_id: string; location_id: string }[],
    retentionDays:
      (settings as { assistant_retention_days: number | null } | null)?.assistant_retention_days ??
      null,
  };
}

export async function listCollections(orgId: string): Promise<Collection[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("knowledge_collections")
    .select("id, name, location_id, min_role")
    .eq("org_id", orgId)
    .order("name");
  type Row = {
    id: string;
    name: string;
    location_id: string | null;
    min_role: Collection["minRole"];
  };
  return ((data ?? []) as Row[]).map((c) => ({
    id: c.id,
    name: c.name,
    locationId: c.location_id,
    minRole: c.min_role,
  }));
}
