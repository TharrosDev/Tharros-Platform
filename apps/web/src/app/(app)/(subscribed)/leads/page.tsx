import Link from "next/link";
import { redirect } from "next/navigation";
import { ExternalLink, Link2, Plus, Search, Sparkles, Users } from "lucide-react";

import { getFeatureAccess } from "@/lib/billing/entitlements";
import { getOrgContext } from "@/lib/org/queries";
import { getURL } from "@/lib/site-url";
import { listCaptureForms, listLeads } from "@/lib/leads/queries";
import { LEAD_STATUSES, type LeadStatus } from "@/lib/leads/types";
import {
  createCaptureForm,
  createManualLead,
  deleteCaptureForm,
  generateLeadFollowUp,
  rotateCaptureFormToken,
  toggleCaptureForm,
  updateCaptureForm,
  updateLeadStatus,
} from "@/lib/leads/actions";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { PanelSheet } from "@/components/ui/panel-sheet";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

const statusLabel = (status: string) => status.charAt(0).toUpperCase() + status.slice(1);

function sourceLabel(source: string) {
  if (source === "public_form") return "Capture form";
  if (source === "api") return "API";
  return "Manual";
}

const ERRORS: Record<string, string> = {
  "usage-limit": "Your organization has reached its monthly AI usage limit.",
  permission: "Only owners and admins can do that.",
};

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    error?: string;
    created?: string;
    drafted?: string;
    "form-created"?: string;
    q?: string;
  }>;
}) {
  const [{ activeOrg }, params, access] = await Promise.all([
    getOrgContext(),
    searchParams,
    getFeatureAccess("leads"),
  ]);
  if (!activeOrg) redirect("/dashboard");
  if (!access.entitled) redirect("/billing");

  const search = params.q?.trim() ?? "";
  const [leads, forms] = await Promise.all([
    listLeads(activeOrg.id, { query: search || null, limit: 200 }),
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
  const withSearch = (status: LeadStatus | null) => {
    const qs = new URLSearchParams();
    if (status) qs.set("status", status);
    if (search) qs.set("q", search);
    const s = qs.toString();
    return s ? `/leads?${s}` : "/leads";
  };
  const filters: { key: string; label: string; count: number; href: string; active: boolean }[] = [
    { key: "all", label: "All", count: leads.length, href: withSearch(null), active: !selectedStatus },
    ...LEAD_STATUSES.map((status) => ({
      key: status,
      label: statusLabel(status),
      count: counts[status],
      href: withSearch(status),
      active: selectedStatus === status,
    })),
  ];

  return (
    <>
      <PageHeader
        title="Lead Capture"
        description="Collect enquiries, work the pipeline and review AI follow-up drafts before anything goes out."
        actions={
          <>
            <PanelSheet
              label="Capture forms"
              icon={<Link2 />}
              title="Capture forms"
              description="Share a public form or post JSON to its tokenized endpoint. New submissions land in the pipeline."
              closeOnSubmit={false}
            >
              <CaptureForms forms={forms} baseUrl={baseUrl} canManage={canManageForms} />
            </PanelSheet>
            <PanelSheet
              label="Add lead"
              icon={<Plus />}
              variant="default"
              title="Add a lead"
              description="Record a phone call, walk-in, referral or other offline enquiry."
            >
              <form action={createManualLead} className="grid gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="lead-name">Name</Label>
                  <Input id="lead-name" name="name" required maxLength={160} />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="lead-email">Email</Label>
                    <Input id="lead-email" name="email" type="email" maxLength={320} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="lead-phone">Phone</Label>
                    <Input id="lead-phone" name="phone" type="tel" maxLength={80} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lead-company">Company</Label>
                  <Input id="lead-company" name="company" maxLength={160} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lead-message">Notes or enquiry</Label>
                  <Textarea id="lead-message" name="message" maxLength={4000} />
                </div>
                <Button type="submit">Add lead</Button>
              </form>
            </PanelSheet>
          </>
        }
      />

      {params.error ? (
        <div role="alert" className="border-destructive/25 bg-destructive/[0.06] text-destructive rounded-lg border px-4 py-3 text-sm">
          {ERRORS[params.error] ?? "That action could not be completed. Check the fields or your permissions."}
        </div>
      ) : params.created || params["form-created"] ? (
        <div role="status" className="border-success/25 bg-success/[0.07] text-success rounded-lg border px-4 py-3 text-sm">
          {params.created ? "Lead added to the pipeline." : "Capture form created."}
        </div>
      ) : null}

      <section aria-labelledby="pipeline-heading" className="space-y-3">
        <h2 id="pipeline-heading" className="sr-only">
          Pipeline
        </h2>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <nav aria-label="Filter by status" className="-mx-4 flex gap-1 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            {filters.map((f) => (
              <Link
                key={f.key}
                href={f.href}
                aria-current={f.active ? "page" : undefined}
                className={cn(
                  "focus-visible:ring-ring/40 inline-flex h-9 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-medium outline-none transition-colors focus-visible:ring-[3px]",
                  f.active
                    ? "bg-card text-foreground border shadow-xs"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                {f.label}
                <span className={cn("num text-xs", f.active ? "text-primary-soft-foreground" : "text-muted-foreground")}>
                  {f.count}
                </span>
              </Link>
            ))}
          </nav>
          <form action="/leads" role="search" className="flex w-full gap-2 sm:w-auto">
            {selectedStatus ? <input type="hidden" name="status" value={selectedStatus} /> : null}
            <div className="relative flex-1 sm:w-72">
              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" aria-hidden />
              <Input
                name="q"
                defaultValue={search}
                placeholder="Name, email, phone or company"
                aria-label="Search leads"
                maxLength={120}
                className="pl-9"
              />
            </div>
            <Button type="submit" variant="outline">
              Search
            </Button>
            {search ? (
              <Link
                href={selectedStatus ? `/leads?status=${selectedStatus}` : "/leads"}
                className={buttonVariants({ variant: "ghost" })}
              >
                Clear
              </Link>
            ) : null}
          </form>
        </div>

        {visibleLeads.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lead</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Follow-up</TableHead>
                <TableHead className="text-right">Received</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleLeads.map((lead) => (
                <TableRow key={lead.id}>
                  <TableCell className="max-w-64">
                    <Link
                      href={`/leads/${lead.id}`}
                      className="focus-visible:ring-ring/40 rounded-sm font-semibold outline-none hover:underline focus-visible:ring-[3px]"
                    >
                      {lead.name}
                    </Link>
                    <div className="text-muted-foreground truncate text-xs">
                      {lead.company ?? lead.message ?? "No details"}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="truncate">{lead.email ?? lead.phone ?? "—"}</div>
                    {lead.email && lead.phone ? (
                      <div className="text-muted-foreground text-xs">{lead.phone}</div>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{sourceLabel(lead.source)}</TableCell>
                  <TableCell>
                    <form action={updateLeadStatus} className="flex items-center gap-1.5">
                      <input type="hidden" name="leadId" value={lead.id} />
                      <NativeSelect
                        name="status"
                        defaultValue={lead.status}
                        aria-label={`Status for ${lead.name}`}
                        className="w-32"
                      >
                        {LEAD_STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {statusLabel(status)}
                          </option>
                        ))}
                      </NativeSelect>
                      <Button type="submit" variant="ghost" size="sm">
                        Save
                      </Button>
                    </form>
                  </TableCell>
                  <TableCell className="min-w-44">
                    {lead.followUpDraft ? (
                      <Link
                        href={`/leads/${lead.id}`}
                        className="focus-visible:ring-ring/40 inline-flex rounded-md outline-none focus-visible:ring-[3px]"
                      >
                        <Badge variant="default">Draft ready to review</Badge>
                      </Link>
                    ) : lead.email ? (
                      <form action={generateLeadFollowUp}>
                        <input type="hidden" name="leadId" value={lead.id} />
                        <Button type="submit" variant="outline" size="sm">
                          <Sparkles />
                          Draft follow-up
                        </Button>
                      </form>
                    ) : (
                      <span className="text-muted-foreground text-xs">Needs an email</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground num text-right whitespace-nowrap">
                    {new Intl.DateTimeFormat("en-CA", { month: "short", day: "numeric" }).format(
                      new Date(lead.createdAt),
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="bg-card/60 rounded-xl border border-dashed px-6 py-10 text-center">
            <Users className="text-muted-foreground mx-auto size-5" aria-hidden />
            <p className="mt-3 font-semibold">{search || selectedStatus ? "No leads match" : "No leads yet"}</p>
            <p className="text-muted-foreground type-small mx-auto mt-1 max-w-sm">
              {search || selectedStatus
                ? "Try another status or search."
                : "Add a lead by hand or share a capture form. Every new lead appears here."}
            </p>
          </div>
        )}
      </section>
    </>
  );
}

function CaptureForms({
  forms,
  baseUrl,
  canManage,
}: {
  forms: Awaited<ReturnType<typeof listCaptureForms>>;
  baseUrl: string;
  canManage: boolean;
}) {
  return (
    <div className="space-y-5">
      {canManage ? (
        <form action={createCaptureForm} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="new-form-name">Internal name</Label>
              <Input id="new-form-name" name="name" placeholder="Website enquiries" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-form-headline">Public headline</Label>
              <Input id="new-form-headline" name="headline" placeholder="Get in touch" />
            </div>
          </div>
          <Button type="submit" variant="outline" size="sm">
            <Plus />
            Create form
          </Button>
        </form>
      ) : null}

      {forms.length ? (
        <ul className="divide-y rounded-xl border">
          {forms.map((form) => {
            const publicUrl = `${baseUrl}/forms/${form.publicToken}`;
            return (
              <li key={form.id} className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold">{form.name}</p>
                      <Badge variant={form.active ? "success" : "secondary"}>{form.active ? "Live" : "Paused"}</Badge>
                    </div>
                    <p className="text-muted-foreground mt-1 truncate text-xs">{publicUrl}</p>
                    <p className="text-muted-foreground num mt-0.5 truncate text-xs">
                      POST /api/leads/capture/{form.publicToken}
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
                {canManage ? (
                  <>
                    <details>
                      <summary className="text-primary-soft-foreground cursor-pointer text-sm font-medium select-none">
                        Edit form settings
                      </summary>
                      <form action={updateCaptureForm} className="mt-3 grid gap-3">
                        <input type="hidden" name="formId" value={form.id} />
                        <div className="space-y-1.5">
                          <Label htmlFor={`form-name-${form.id}`}>Internal name</Label>
                          <Input id={`form-name-${form.id}`} name="name" defaultValue={form.name} maxLength={120} required />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor={`form-headline-${form.id}`}>Public headline</Label>
                          <Input id={`form-headline-${form.id}`} name="headline" defaultValue={form.headline} maxLength={240} />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor={`form-success-${form.id}`}>Success message</Label>
                          <Textarea
                            id={`form-success-${form.id}`}
                            name="successMessage"
                            defaultValue={form.successMessage}
                            maxLength={500}
                          />
                        </div>
                        <Button type="submit" variant="outline" size="sm" className="justify-self-start">
                          Save form settings
                        </Button>
                      </form>
                    </details>
                    <div className="flex flex-wrap gap-2">
                      <form action={toggleCaptureForm}>
                        <input type="hidden" name="formId" value={form.id} />
                        <input type="hidden" name="active" value={form.active ? "false" : "true"} />
                        <Button type="submit" variant="outline" size="sm">
                          {form.active ? "Pause form" : "Turn on form"}
                        </Button>
                      </form>
                      <form action={rotateCaptureFormToken}>
                        <input type="hidden" name="formId" value={form.id} />
                        <Button type="submit" variant="outline" size="sm">
                          Rotate public link
                        </Button>
                      </form>
                      <form action={deleteCaptureForm}>
                        <input type="hidden" name="formId" value={form.id} />
                        <Button type="submit" variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive">
                          Delete
                        </Button>
                      </form>
                    </div>
                    <p className="text-muted-foreground text-xs">
                      Rotating the link immediately stops the old form and API URL from working.
                    </p>
                  </>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-muted-foreground rounded-xl border border-dashed px-4 py-6 text-center text-sm">
          {canManage ? "No capture forms yet. Create one above to get a shareable link." : "An owner or admin can create public forms."}
        </p>
      )}
    </div>
  );
}
