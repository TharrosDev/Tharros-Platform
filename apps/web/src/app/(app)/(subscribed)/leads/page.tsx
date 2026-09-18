import Link from "next/link";
import { redirect } from "next/navigation";
import { ExternalLink, Inbox, Link2, Plus, Sparkles, Users } from "lucide-react";

import { getOrgContext } from "@/lib/org/queries";
import { getURL } from "@/lib/site-url";
import { listCaptureForms, listLeads } from "@/lib/leads/queries";
import { LEAD_STATUSES, type LeadStatus } from "@/lib/leads/types";
import {
  createCaptureForm,
  createManualLead,
  generateLeadFollowUp,
  toggleCaptureForm,
  updateLeadStatus,
} from "@/lib/leads/actions";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

function statusVariant(status: LeadStatus) {
  if (status === "won") return "success" as const;
  if (status === "contacted") return "info" as const;
  if (status === "qualified") return "default" as const;
  if (status === "lost") return "outline" as const;
  return "secondary" as const;
}

function sourceLabel(source: string) {
  if (source === "public_form") return "Capture form";
  if (source === "api") return "API";
  return "Manual";
}

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    error?: string;
    created?: string;
    drafted?: string;
    "form-created"?: string;
  }>;
}) {
  const [{ activeOrg }, params] = await Promise.all([getOrgContext(), searchParams]);
  if (!activeOrg) redirect("/dashboard");

  const [leads, forms] = await Promise.all([
    listLeads(activeOrg.id, { limit: 200 }),
    listCaptureForms(activeOrg.id),
  ]);
  const selectedStatus = LEAD_STATUSES.includes(params.status as LeadStatus)
    ? (params.status as LeadStatus)
    : null;
  const visibleLeads = selectedStatus ? leads.filter((lead) => lead.status === selectedStatus) : leads;
  const canManageForms = activeOrg.role === "owner" || activeOrg.role === "admin";
  const baseUrl = getURL();

  const counts = Object.fromEntries(
    LEAD_STATUSES.map((status) => [status, leads.filter((lead) => lead.status === status).length]),
  ) as Record<LeadStatus, number>;

  return (
    <>
      <PageHeader
        title="Lead Capture"
        description="Collect enquiries, manage the pipeline, draft follow-ups with AI, and trigger automations from real lead events."
      />

      {params.error ? (
        <div className="border-destructive/30 bg-destructive/10 text-destructive rounded-lg border px-4 py-3 text-sm">
          {params.error === "usage-limit"
            ? "Your organization has reached its monthly AI usage limit."
            : "That action could not be completed. Check the submitted fields or your permissions."}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {LEAD_STATUSES.map((status) => (
          <Link
            key={status}
            href={selectedStatus === status ? "/leads" : `/leads?status=${status}`}
            className={cn(
              "bg-card rounded-xl border p-4 shadow-xs transition-shadow hover:shadow-card-hover",
              selectedStatus === status && "border-primary/40 ring-primary/15 ring-2",
            )}
          >
            <span className="type-meta text-muted-foreground">{status}</span>
            <span className="num mt-2 block text-2xl font-bold">{counts[status]}</span>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Add a lead</CardTitle>
            <CardDescription>Record a phone, walk-in, referral, or other offline enquiry.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={createManualLead} className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="lead-name">Name</Label>
                <Input id="lead-name" name="name" required maxLength={160} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lead-email">Email</Label>
                <Input id="lead-email" name="email" type="email" maxLength={320} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lead-phone">Phone</Label>
                <Input id="lead-phone" name="phone" type="tel" maxLength={80} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="lead-company">Company</Label>
                <Input id="lead-company" name="company" maxLength={160} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="lead-message">Notes / enquiry</Label>
                <Textarea id="lead-message" name="message" maxLength={4000} />
              </div>
              <div className="sm:col-span-2">
                <Button type="submit">
                  <Plus />
                  Add lead
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Capture forms</CardTitle>
            <CardDescription>
              Share a public Tharros form or post JSON to the tokenized capture endpoint.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {canManageForms ? (
              <form action={createCaptureForm} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                <Input name="name" placeholder="Website enquiries" aria-label="Form name" required />
                <Input name="headline" placeholder="Get in touch" aria-label="Public headline" />
                <Button type="submit" variant="outline">
                  Create
                </Button>
              </form>
            ) : null}

            {forms.length ? (
              <div className="space-y-3">
                {forms.map((form) => {
                  const publicUrl = `${baseUrl}/forms/${form.publicToken}`;
                  return (
                    <div key={form.id} className="bg-surface-2 rounded-lg border border-border/70 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-medium">{form.name}</p>
                            <Badge variant={form.active ? "success" : "secondary"}>
                              {form.active ? "Live" : "Paused"}
                            </Badge>
                          </div>
                          <p className="text-muted-foreground mt-1 truncate text-xs">{publicUrl}</p>
                          <p className="text-muted-foreground mt-1 text-xs">
                            API: POST /api/leads/capture/{form.publicToken}
                          </p>
                        </div>
                        <Link
                          href={publicUrl}
                          target="_blank"
                          rel="noreferrer"
                          className={buttonVariants({ variant: "ghost", size: "sm" })}
                        >
                          <ExternalLink />
                          Open
                        </Link>
                      </div>
                      {canManageForms ? (
                        <form action={toggleCaptureForm} className="mt-3">
                          <input type="hidden" name="formId" value={form.id} />
                          <input type="hidden" name="active" value={form.active ? "false" : "true"} />
                          <Button type="submit" variant="outline" size="sm">
                            {form.active ? "Pause form" : "Enable form"}
                          </Button>
                        </form>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-surface-2 rounded-lg border border-dashed p-5 text-center">
                <Link2 className="text-muted-foreground mx-auto size-5" />
                <p className="mt-2 text-sm font-medium">No capture forms yet</p>
                <p className="text-muted-foreground type-small mt-1">
                  {canManageForms
                    ? "Create one to get a shareable public contact form."
                    : "An owner or admin can create public forms."}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Inbox className="size-4" />
                Pipeline
              </CardTitle>
              <CardDescription>
                {selectedStatus ? `${visibleLeads.length} ${selectedStatus} leads` : `${leads.length} recent leads`}
              </CardDescription>
            </div>
            {selectedStatus ? (
              <Link href="/leads" className={buttonVariants({ variant: "outline", size: "sm" })}>
                Show all
              </Link>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          {visibleLeads.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lead</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Follow-up</TableHead>
                  <TableHead>Received</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleLeads.map((lead) => (
                  <TableRow key={lead.id}>
                    <TableCell>
                      <div className="font-medium">{lead.name}</div>
                      <div className="text-muted-foreground max-w-xs truncate text-xs">
                        {lead.company ?? lead.message ?? "No additional details"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>{lead.email ?? lead.phone ?? "—"}</div>
                      {lead.email && lead.phone ? (
                        <div className="text-muted-foreground text-xs">{lead.phone}</div>
                      ) : null}
                    </TableCell>
                    <TableCell>{sourceLabel(lead.source)}</TableCell>
                    <TableCell>
                      <form action={updateLeadStatus} className="flex items-center gap-2">
                        <input type="hidden" name="leadId" value={lead.id} />
                        <select
                          name="status"
                          defaultValue={lead.status}
                          aria-label={`Status for ${lead.name}`}
                          className="border-input bg-card h-9 rounded-md border px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40"
                        >
                          {LEAD_STATUSES.map((status) => (
                            <option key={status} value={status}>
                              {status[0].toUpperCase() + status.slice(1)}
                            </option>
                          ))}
                        </select>
                        <Button type="submit" variant="ghost" size="sm">
                          Save
                        </Button>
                      </form>
                      <Badge className="mt-1" variant={statusVariant(lead.status)}>
                        {lead.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="min-w-52">
                      {lead.email ? (
                        <div className="space-y-2">
                          <form action={generateLeadFollowUp}>
                            <input type="hidden" name="leadId" value={lead.id} />
                            <Button type="submit" variant="outline" size="sm">
                              <Sparkles />
                              {lead.followUpDraft ? "Redraft" : "Draft"}
                            </Button>
                          </form>
                          {lead.followUpDraft ? (
                            <details className="text-xs">
                              <summary className="text-primary cursor-pointer font-medium">
                                View latest draft
                              </summary>
                              <div className="bg-surface-2 mt-2 max-w-sm rounded-lg border p-3">
                                <p className="font-semibold">{lead.followUpSubject ?? "Following up"}</p>
                                <p className="text-muted-foreground mt-2 whitespace-pre-wrap">
                                  {lead.followUpDraft}
                                </p>
                              </div>
                            </details>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">Email required</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {new Intl.DateTimeFormat("en-CA", {
                        month: "short",
                        day: "numeric",
                      }).format(new Date(lead.createdAt))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="bg-surface-2 rounded-lg border border-dashed p-8 text-center">
              <Users className="text-muted-foreground mx-auto size-5" />
              <p className="mt-2 text-sm font-medium">No leads in this view</p>
              <p className="text-muted-foreground type-small mt-1">
                Add one manually or share a capture form.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
