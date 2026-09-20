import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Mail, Send, ShieldCheck, Sparkles, StickyNote } from "lucide-react";

import { getFeatureAccess } from "@/lib/billing/entitlements";
import { getOrgContext } from "@/lib/org/queries";
import { getLead, listLeadEvents } from "@/lib/leads/queries";
import { LEAD_STATUSES, type LeadEvent, type LeadStatus } from "@/lib/leads/types";
import {
  addLeadNote,
  generateLeadFollowUp,
  sendLeadFollowUp,
  updateLeadDetails,
  updateLeadStatus,
} from "@/lib/leads/actions";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Lead" };

const statusLabel = (status: string) => status.charAt(0).toUpperCase() + status.slice(1);

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
    const to = typeof event.data.to === "string" ? statusLabel(event.data.to) : "another status";
    return `Status changed to ${to}`;
  }
  if (event.type === "lead.note_added") return "Internal note";
  if (event.type === "lead.followup_drafted") return "AI follow-up drafted";
  if (event.type === "lead.followup_sent") return "Follow-up sent";
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
    return from && to ? `${statusLabel(from)} → ${statusLabel(to)}` : null;
  }
  if (event.type === "lead.followup_sent" && typeof event.data.subject === "string") {
    return `Subject: ${event.data.subject}`;
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
  searchParams: Promise<{ error?: string; drafted?: string; sent?: string }>;
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
      <div className="space-y-4">
        <Link
          href="/leads"
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "-ml-2.5")}
        >
          <ArrowLeft />
          Lead Capture
        </Link>
        <PageHeader
          title={lead.name}
          description={[lead.company, lead.email].filter(Boolean).join(" · ") || "Lead record"}
          actions={<Badge variant={statusVariant(lead.status)}>{statusLabel(lead.status)}</Badge>}
        />
      </div>

      {query.error ? (
        <div
          role="alert"
          className="border-destructive/25 bg-destructive/[0.06] text-destructive rounded-lg border px-4 py-3 text-sm"
        >
          That action could not be completed.
        </div>
      ) : query.drafted ? (
        <div
          role="status"
          className="border-primary/20 bg-primary-soft/50 text-primary-soft-foreground rounded-lg border px-4 py-3 text-sm"
        >
          A new follow-up draft is ready. Review it below before sending.
        </div>
      ) : query.sent ? (
        <div
          role="status"
          className="border-success/25 bg-success/[0.07] text-success rounded-lg border px-4 py-3 text-sm"
        >
          Follow-up sent. The timeline has been updated.
        </div>
      ) : null}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="min-w-0 space-y-8">
          <section aria-labelledby="followup-heading">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 id="followup-heading" className="type-h2">
                Follow-up
              </h2>
              {lead.email ? (
                <form action={generateLeadFollowUp}>
                  <input type="hidden" name="leadId" value={lead.id} />
                  <Button
                    type="submit"
                    variant={lead.followUpDraft ? "ghost" : "outline"}
                    size="sm"
                  >
                    <Sparkles />
                    {lead.followUpDraft ? "Regenerate" : "Draft with AI"}
                  </Button>
                </form>
              ) : null}
            </div>

            {!lead.email ? (
              <div className="bg-card/60 rounded-xl border border-dashed px-5 py-5">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <Mail className="size-4" aria-hidden />
                  Add an email to follow up
                </p>
                <p className="text-muted-foreground type-small mt-1">
                  AI drafts and sending need an email address. Add one in the details panel.
                </p>
              </div>
            ) : lead.followUpDraft ? (
              <article className="bg-card rounded-xl border shadow-card">
                <header className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-3">
                  <div className="min-w-0">
                    <p className="text-muted-foreground text-xs">To {lead.email}</p>
                    <p className="truncate font-semibold">
                      {lead.followUpSubject ?? "Following up"}
                    </p>
                  </div>
                  <Badge variant="warning">Awaiting your review</Badge>
                </header>
                <p className="px-5 py-4 text-[0.9375rem] leading-relaxed whitespace-pre-wrap">
                  {lead.followUpDraft}
                </p>
                <footer className="bg-surface-2/60 flex flex-wrap items-center justify-between gap-3 rounded-b-xl border-t px-5 py-3">
                  <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                    <ShieldCheck className="size-3.5" aria-hidden />
                    {lead.followUpDraftedAt
                      ? `Drafted ${formatDate(lead.followUpDraftedAt)}. `
                      : ""}
                    Nothing is sent until you choose to.
                  </p>
                  <form action={sendLeadFollowUp}>
                    <input type="hidden" name="leadId" value={lead.id} />
                    <Button type="submit">
                      <Send />
                      Send to {lead.email}
                    </Button>
                  </form>
                </footer>
              </article>
            ) : (
              <div className="bg-card/60 rounded-xl border border-dashed px-5 py-5">
                <p className="text-sm font-semibold">No draft yet</p>
                <p className="text-muted-foreground type-small mt-1">
                  Draft a reply with AI from the enquiry and your documents. You review the exact
                  copy before anything is sent.
                </p>
              </div>
            )}
          </section>

          <section aria-labelledby="timeline-heading">
            <h2 id="timeline-heading" className="type-h2 mb-3">
              Activity
            </h2>
            <form
              action={addLeadNote}
              className="bg-card mb-5 space-y-2 rounded-xl border p-3 shadow-card"
            >
              <input type="hidden" name="leadId" value={lead.id} />
              <Textarea
                name="note"
                aria-label="Internal note"
                placeholder="Add an internal note: call outcome, context, next step…"
                maxLength={4000}
                required
                className="min-h-16 border-0 px-1 shadow-none hover:border-0 "
              />
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground text-xs">
                  Visible to your organization only
                </span>
                <Button type="submit" variant="outline" size="sm">
                  <StickyNote />
                  Add note
                </Button>
              </div>
            </form>

            {events.length ? (
              <ol className="relative space-y-5 pl-6 before:absolute before:top-1.5 before:bottom-1.5 before:left-[0.3125rem] before:w-px before:bg-border">
                {events.map((event) => {
                  const body = eventBody(event);
                  return (
                    <li key={event.id} className="relative">
                      <span
                        aria-hidden
                        className={cn(
                          "absolute top-1.5 -left-6 size-[0.6875rem] rounded-full border-2 border-background",
                          event.type === "lead.note_added" ? "bg-muted-foreground" : "bg-primary",
                        )}
                      />
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                        <p className="text-sm font-semibold">{eventTitle(event)}</p>
                        <time className="text-muted-foreground text-xs" dateTime={event.createdAt}>
                          {formatDate(event.createdAt)}
                        </time>
                      </div>
                      {body ? (
                        <p
                          className={cn(
                            "mt-1 text-sm whitespace-pre-wrap",
                            event.type === "lead.note_added"
                              ? "bg-card rounded-lg border px-3 py-2"
                              : "text-muted-foreground",
                          )}
                        >
                          {body}
                        </p>
                      ) : null}
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="text-muted-foreground text-sm">No activity yet.</p>
            )}
          </section>
        </div>

        <aside className="space-y-6 lg:sticky lg:top-20">
          <section
            aria-labelledby="status-heading"
            className="bg-card rounded-xl border p-4 shadow-card"
          >
            <h2 id="status-heading" className="text-sm font-semibold">
              Pipeline
            </h2>
            <form action={updateLeadStatus} className="mt-3 flex gap-2">
              <input type="hidden" name="leadId" value={lead.id} />
              <NativeSelect
                id="lead-detail-status"
                name="status"
                defaultValue={lead.status}
                aria-label="Pipeline status"
                className="flex-1"
              >
                {LEAD_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {statusLabel(status)}
                  </option>
                ))}
              </NativeSelect>
              <Button type="submit" variant="outline">
                Update
              </Button>
            </form>
            <dl className="mt-4 space-y-2 border-t pt-3 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Source</dt>
                <dd className="capitalize">{lead.source.replaceAll("_", " ")}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Received</dt>
                <dd className="text-right">{formatDate(lead.createdAt)}</dd>
              </div>
            </dl>
          </section>

          <section
            aria-labelledby="details-heading"
            className="bg-card rounded-xl border p-4 shadow-card"
          >
            <h2 id="details-heading" className="text-sm font-semibold">
              Contact details
            </h2>
            <form action={updateLeadDetails} className="mt-3 grid gap-3">
              <input type="hidden" name="leadId" value={lead.id} />
              <div className="space-y-1.5">
                <Label htmlFor="lead-edit-name">Name</Label>
                <Input
                  id="lead-edit-name"
                  name="name"
                  defaultValue={lead.name}
                  maxLength={160}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lead-edit-email">Email</Label>
                <Input
                  id="lead-edit-email"
                  name="email"
                  type="email"
                  defaultValue={lead.email ?? ""}
                  maxLength={320}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lead-edit-phone">Phone</Label>
                <Input
                  id="lead-edit-phone"
                  name="phone"
                  type="tel"
                  defaultValue={lead.phone ?? ""}
                  maxLength={80}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lead-edit-company">Company</Label>
                <Input
                  id="lead-edit-company"
                  name="company"
                  defaultValue={lead.company ?? ""}
                  maxLength={160}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lead-edit-message">Enquiry</Label>
                <Textarea
                  id="lead-edit-message"
                  name="message"
                  defaultValue={lead.message ?? ""}
                  maxLength={4000}
                />
              </div>
              <Button type="submit" variant="outline" className="justify-self-start">
                Save details
              </Button>
            </form>
          </section>
        </aside>
      </div>
    </>
  );
}
