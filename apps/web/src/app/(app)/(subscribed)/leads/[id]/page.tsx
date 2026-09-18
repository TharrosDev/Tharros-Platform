import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  Clock3,
  Mail,
  MessageSquareText,
  Phone,
  Sparkles,
  StickyNote,
} from "lucide-react";

import { getFeatureAccess } from "@/lib/billing/entitlements";
import { getOrgContext } from "@/lib/org/queries";
import { getLead, listLeadEvents } from "@/lib/leads/queries";
import { LEAD_STATUSES, type LeadEvent, type LeadStatus } from "@/lib/leads/types";
import {
  addLeadNote,
  generateLeadFollowUp,
  updateLeadStatus,
} from "@/lib/leads/actions";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const metadata: Metadata = { title: "Lead" };

function statusVariant(status: LeadStatus) {
  if (status === "won") return "success" as const;
  if (status === "contacted") return "info" as const;
  if (status === "qualified") return "default" as const;
  if (status === "lost") return "outline" as const;
  return "secondary" as const;
}

function eventTitle(event: LeadEvent): string {
  if (event.type === "lead.created") return "Lead created";
  if (event.type === "lead.status_changed") {
    const to = typeof event.data.to === "string" ? event.data.to : "another status";
    return `Status changed to ${to}`;
  }
  if (event.type === "lead.note_added") return "Internal note";
  if (event.type === "lead.followup_drafted") return "AI follow-up drafted";
  if (event.type === "automation.action") return "Automation action";
  return event.type;
}

function eventBody(event: LeadEvent): string | null {
  if (event.type === "lead.note_added" && typeof event.data.note === "string") {
    return event.data.note;
  }
  if (event.type === "lead.status_changed") {
    const from = typeof event.data.from === "string" ? event.data.from : null;
    const to = typeof event.data.to === "string" ? event.data.to : null;
    return from && to ? `${from} → ${to}` : null;
  }
  if (event.type === "automation.action") {
    const action = typeof event.data.action === "string" ? event.data.action : "workflow action";
    const to = typeof event.data.to === "string" ? ` → ${event.data.to}` : "";
    return `${action.replaceAll("_", " ")}${to}`;
  }
  if (event.type === "lead.created" && typeof event.data.source === "string") {
    return `Source: ${event.data.source.replaceAll("_", " ")}`;
  }
  return null;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default async function LeadDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; drafted?: string }>;
}) {
  const [{ activeOrg }, { id }, query, access] = await Promise.all([
    getOrgContext(),
    params,
    searchParams,
    getFeatureAccess("leads"),
  ]);

  if (!activeOrg) redirect("/dashboard");
  if (!access.entitled) redirect("/billing");

  const [lead, events] = await Promise.all([
    getLead(activeOrg.id, id),
    listLeadEvents(activeOrg.id, id),
  ]);
  if (!lead) notFound();

  return (
    <>
      <PageHeader
        title={lead.name}
        description={lead.company ?? "Lead record"}
        actions={
          <Link href="/leads" className={buttonVariants({ variant: "outline" })}>
            <ArrowLeft />
            Back to leads
          </Link>
        }
      />

      {query.error ? (
        <div className="border-destructive/30 bg-destructive/10 text-destructive rounded-lg border px-4 py-3 text-sm">
          That action could not be completed.
        </div>
      ) : null}

      {query.drafted ? (
        <div className="border-success/30 bg-success/10 text-success rounded-lg border px-4 py-3 text-sm">
          A new follow-up draft is ready for review.
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Lead details</CardTitle>
              <CardDescription>Contact and pipeline information.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={statusVariant(lead.status)}>{lead.status}</Badge>
                <Badge variant="outline">{lead.source.replaceAll("_", " ")}</Badge>
              </div>

              <div className="space-y-3 text-sm">
                {lead.email ? (
                  <a href={`mailto:${lead.email}`} className="flex items-center gap-2 hover:underline">
                    <Mail className="text-muted-foreground size-4" />
                    {lead.email}
                  </a>
                ) : null}
                {lead.phone ? (
                  <a href={`tel:${lead.phone}`} className="flex items-center gap-2 hover:underline">
                    <Phone className="text-muted-foreground size-4" />
                    {lead.phone}
                  </a>
                ) : null}
                {lead.company ? (
                  <div className="flex items-center gap-2">
                    <Building2 className="text-muted-foreground size-4" />
                    {lead.company}
                  </div>
                ) : null}
                <div className="text-muted-foreground flex items-center gap-2">
                  <Clock3 className="size-4" />
                  Received {formatDate(lead.createdAt)}
                </div>
              </div>

              {lead.message ? (
                <div className="bg-surface-2 rounded-lg border p-3">
                  <p className="text-muted-foreground type-meta">Original enquiry</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm">{lead.message}</p>
                </div>
              ) : null}

              <form action={updateLeadStatus} className="space-y-2">
                <input type="hidden" name="leadId" value={lead.id} />
                <Label htmlFor="lead-detail-status">Pipeline status</Label>
                <div className="flex gap-2">
                  <select
                    id="lead-detail-status"
                    name="status"
                    defaultValue={lead.status}
                    className="border-input bg-card h-10 flex-1 rounded-md border px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40"
                  >
                    {LEAD_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {status[0].toUpperCase() + status.slice(1)}
                      </option>
                    ))}
                  </select>
                  <Button type="submit" variant="outline">Update</Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="size-4" />
                Follow-up draft
              </CardTitle>
              <CardDescription>
                AI prepares copy for a person to review. Tharros does not send it automatically.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {lead.email ? (
                <>
                  <form action={generateLeadFollowUp}>
                    <input type="hidden" name="leadId" value={lead.id} />
                    <Button type="submit" variant="outline">
                      <Sparkles />
                      {lead.followUpDraft ? "Generate a new draft" : "Generate draft"}
                    </Button>
                  </form>
                  {lead.followUpDraft ? (
                    <div className="bg-surface-2 rounded-lg border p-4">
                      <p className="font-semibold">{lead.followUpSubject ?? "Following up"}</p>
                      <p className="text-muted-foreground mt-3 whitespace-pre-wrap text-sm leading-relaxed">
                        {lead.followUpDraft}
                      </p>
                      {lead.followUpDraftedAt ? (
                        <p className="text-muted-foreground type-meta mt-3">
                          Drafted {formatDate(lead.followUpDraftedAt)}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </>
              ) : (
                <p className="text-muted-foreground text-sm">
                  Add an email address before drafting an email follow-up.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <StickyNote className="size-4" />
                Add internal note
              </CardTitle>
              <CardDescription>
                Notes are recorded in the lead timeline and stay inside this organization.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form action={addLeadNote} className="space-y-3">
                <input type="hidden" name="leadId" value={lead.id} />
                <Textarea
                  name="note"
                  aria-label="Internal note"
                  placeholder="Call outcome, context, next step..."
                  maxLength={4000}
                  required
                />
                <Button type="submit" variant="outline">
                  <StickyNote />
                  Add note
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquareText className="size-4" />
                Timeline
              </CardTitle>
              <CardDescription>
                Lead activity, notes, follow-up generation, and automation actions.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {events.length ? (
                <ol className="space-y-4">
                  {events.map((event) => (
                    <li key={event.id} className="border-l-2 border-border pl-4">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="text-sm font-medium">{eventTitle(event)}</p>
                        <time className="text-muted-foreground type-meta" dateTime={event.createdAt}>
                          {formatDate(event.createdAt)}
                        </time>
                      </div>
                      {eventBody(event) ? (
                        <p className="text-muted-foreground mt-1 whitespace-pre-wrap text-sm">
                          {eventBody(event)}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-muted-foreground text-sm">No timeline events yet.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
