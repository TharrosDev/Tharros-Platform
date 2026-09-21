import type { Metadata } from "next";
import Link from "next/link";
import { X } from "lucide-react";

import { getSubscription } from "@/lib/billing/entitlements";
import { ENTERPRISE_PLAN } from "@/lib/billing/plans";
import {
  assignMemberLocation,
  createLocation,
  deleteLocation,
  setRetentionDays,
  unassignMemberLocation,
} from "@/lib/enterprise/actions";
import { getEnterpriseSettings } from "@/lib/enterprise/queries";
import { getOrgContext } from "@/lib/org/queries";
import { getTeam } from "@/lib/team/queries";
import { NoActiveOrg } from "@/components/access-notice";
import { PageHeader } from "@/components/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";

export const metadata: Metadata = { title: "Enterprise" };

export default async function EnterpriseSettingsPage() {
  const [{ activeOrg }, sub] = await Promise.all([getOrgContext(), getSubscription()]);
  const header = (
    <PageHeader
      title="Enterprise"
      description="Locations, knowledge access, conversation retention and audit export."
    />
  );
  if (!activeOrg) {
    return (
      <>
        {header}
        <NoActiveOrg what="manage enterprise settings" />
      </>
    );
  }

  if (sub?.tier !== "enterprise") {
    return (
      <>
        {header}
        <Card>
          <CardHeader>
            <CardTitle>{ENTERPRISE_PLAN.name} plan</CardTitle>
            <CardDescription>{ENTERPRISE_PLAN.blurb}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="text-muted-foreground list-disc space-y-1 pl-5 text-sm">
              {ENTERPRISE_PLAN.features.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
            <Link href="/contact" className={buttonVariants()}>
              Contact sales
            </Link>
          </CardContent>
        </Card>
      </>
    );
  }

  const isManager = activeOrg.role === "owner" || activeOrg.role === "admin";
  const [{ locations, assignments, retentionDays }, team] = await Promise.all([
    getEnterpriseSettings(activeOrg.id),
    getTeam(),
  ]);
  const locationName = new Map(locations.map((l) => [l.id, l.name]));

  return (
    <>
      {header}

      <Card>
        <CardHeader>
          <CardTitle>Locations</CardTitle>
          <CardDescription>
            Sites or branches. Assign members to them, and scope knowledge collections to a location
            so only its staff can read them.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {locations.length === 0 ? (
            <p className="text-muted-foreground text-sm">No locations yet.</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {locations.map((l) => (
                <li
                  key={l.id}
                  className="bg-muted flex items-center gap-1 rounded-full py-1 pr-1 pl-3 text-sm"
                >
                  {l.name}
                  {isManager ? (
                    <form action={deleteLocation}>
                      <input type="hidden" name="id" value={l.id} />
                      <button
                        type="submit"
                        aria-label={`Delete ${l.name}`}
                        className="text-muted-foreground hover:text-foreground rounded-full p-1"
                      >
                        <X className="size-3.5" />
                      </button>
                    </form>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          {isManager ? (
            <form action={createLocation} className="flex max-w-md gap-2">
              <label htmlFor="location-name" className="sr-only">
                Location name
              </label>
              <Input id="location-name" name="name" placeholder="e.g. Ottawa – Bank St" required />
              <Button type="submit" variant="outline">
                Add
              </Button>
            </form>
          ) : null}
        </CardContent>
      </Card>

      {locations.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Member locations</CardTitle>
            <CardDescription>
              Owners can read every location&apos;s knowledge. Other members only see
              location-scoped collections for the locations they&apos;re assigned to.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {team.members.map((m) => {
                const mine = assignments.filter((a) => a.user_id === m.userId);
                const unassigned = locations.filter(
                  (l) => !mine.some((a) => a.location_id === l.id),
                );
                return (
                  <li key={m.userId} className="flex flex-wrap items-center gap-3 py-3 text-sm">
                    <span className="min-w-40 font-medium">{m.name ?? m.email}</span>
                    <span className="flex flex-1 flex-wrap gap-1.5">
                      {mine.map((a) => (
                        <span
                          key={a.location_id}
                          className="bg-muted flex items-center gap-1 rounded-full py-0.5 pr-1 pl-2.5"
                        >
                          {locationName.get(a.location_id)}
                          {isManager ? (
                            <form action={unassignMemberLocation}>
                              <input type="hidden" name="userId" value={m.userId} />
                              <input type="hidden" name="locationId" value={a.location_id} />
                              <button
                                type="submit"
                                aria-label="Remove location"
                                className="text-muted-foreground hover:text-foreground rounded-full p-0.5"
                              >
                                <X className="size-3" />
                              </button>
                            </form>
                          ) : null}
                        </span>
                      ))}
                    </span>
                    {isManager && unassigned.length > 0 ? (
                      <form action={assignMemberLocation} className="flex gap-2">
                        <input type="hidden" name="userId" value={m.userId} />
                        <NativeSelect name="locationId" aria-label="Location" className="w-44">
                          {unassigned.map((l) => (
                            <option key={l.id} value={l.id}>
                              {l.name}
                            </option>
                          ))}
                        </NativeSelect>
                        <Button type="submit" size="sm" variant="outline">
                          Assign
                        </Button>
                      </form>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Conversation retention</CardTitle>
          <CardDescription>
            Assistant conversations untouched for longer than this are deleted automatically each
            day. Leave blank to keep them.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={setRetentionDays} className="flex max-w-sm items-center gap-2">
            <label htmlFor="retention-days" className="sr-only">
              Days to keep conversations
            </label>
            <Input
              id="retention-days"
              name="days"
              type="number"
              min={1}
              max={3650}
              placeholder="Keep forever"
              defaultValue={retentionDays ?? ""}
              disabled={!isManager}
            />
            <span className="text-muted-foreground text-sm">days</span>
            {isManager ? (
              <Button type="submit" variant="outline">
                Save
              </Button>
            ) : null}
          </form>
        </CardContent>
      </Card>

      {activeOrg.role === "owner" ? (
        <Card>
          <CardHeader>
            <CardTitle>Audit log</CardTitle>
            <CardDescription>
              Download the organization&apos;s activity history (assistant actions and scheduling
              changes) as CSV.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <a href="/api/audit/export" className={buttonVariants({ variant: "outline" })}>
              Download CSV
            </a>
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}
