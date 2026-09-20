import { redirect } from "next/navigation";
import { ArrowRight, BellRing, PlayCircle, ShieldCheck, Trash2, Workflow, Zap } from "lucide-react";

import { getFeatureAccess } from "@/lib/billing/entitlements";
import { getOrgContext } from "@/lib/org/queries";
import { listAutomations, listAutomationRuns } from "@/lib/automations/queries";
import {
  createAutomation,
  deleteAutomation,
  runAutomationNow,
  toggleAutomation,
  updateAutomation,
} from "@/lib/automations/actions";
import { listLeads } from "@/lib/leads/queries";
import { LEAD_STATUSES } from "@/lib/leads/types";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata = { title: "Automations" };

const statusLabel = (status: string) => status.charAt(0).toUpperCase() + status.slice(1);

function triggerLabel(type: string, config: Record<string, unknown>) {
  if (type === "lead.created") return "A lead is created";
  return typeof config.toStatus === "string"
    ? `A lead becomes ${statusLabel(config.toStatus)}`
    : "A lead's status changes";
}

function actionLabel(type: string, config: Record<string, unknown>) {
  if (type === "notify_team")
    return config.email === true ? "Notify managers and email them" : "Notify managers";
  if (type === "draft_follow_up") return "Prepare an AI follow-up draft for review";
  return typeof config.status === "string"
    ? `Set status to ${statusLabel(config.status)}`
    : "Set lead status";
}

function runVariant(status: string) {
  if (status === "succeeded") return "success" as const;
  if (status === "failed") return "destructive" as const;
  if (status === "running") return "info" as const;
  return "secondary" as const;
}

const StatusOptions = () =>
  LEAD_STATUSES.map((status) => (
    <option key={status} value={status}>
      {statusLabel(status)}
    </option>
  ));

export default async function AutomationsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; created?: string; queued?: string }>;
}) {
  const [{ activeOrg }, params, access] = await Promise.all([
    getOrgContext(),
    searchParams,
    getFeatureAccess("automations"),
  ]);
  if (!activeOrg) redirect("/dashboard");
  if (!access.entitled) redirect("/billing");

  const [automations, runs, leads] = await Promise.all([
    listAutomations(activeOrg.id),
    listAutomationRuns(activeOrg.id),
    listLeads(activeOrg.id, { limit: 100 }),
  ]);
  const canManage = activeOrg.role === "owner" || activeOrg.role === "admin";
  const names = new Map(automations.map((automation) => [automation.id, automation.name]));

  return (
    <>
      <PageHeader
        title="Automations"
        description="Durable workflows that react to lead events. Every run is recorded, and you can pause or test any workflow."
      />

      {params.queued ? (
        <div
          role="status"
          className="border-success/25 bg-success/[0.07] text-success rounded-lg border px-4 py-3 text-sm"
        >
          Workflow queued. Its result appears in Run history once the jobs worker processes it.
        </div>
      ) : null}
      {params.error ? (
        <div
          role="alert"
          className="border-destructive/25 bg-destructive/[0.06] text-destructive rounded-lg border px-4 py-3 text-sm"
        >
          That automation could not be saved. Check the fields and your permissions.
        </div>
      ) : null}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section aria-labelledby="workflows-heading" className="min-w-0">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 id="workflows-heading" className="type-h2">
              Workflows
            </h2>
            <span className="text-muted-foreground text-sm">
              {automations.filter((a) => a.enabled).length} of {automations.length} on
            </span>
          </div>

          {automations.length ? (
            <ul className="space-y-3">
              {automations.map((automation) => (
                <li key={automation.id} className="bg-card rounded-xl border">
                  <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-4 sm:px-5">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span
                        aria-hidden
                        className={cn(
                          "size-2 shrink-0 ",
                          automation.enabled ? "bg-success" : "bg-muted-foreground/40",
                        )}
                      />
                      <p className="truncate font-semibold">{automation.name}</p>
                      <Badge variant={automation.enabled ? "success" : "secondary"}>
                        {automation.enabled ? "On" : "Paused"}
                      </Badge>
                    </div>
                    {canManage ? (
                      <div className="flex items-center gap-1">
                        <form action={toggleAutomation}>
                          <input type="hidden" name="automationId" value={automation.id} />
                          <input
                            type="hidden"
                            name="enabled"
                            value={automation.enabled ? "false" : "true"}
                          />
                          <Button type="submit" variant="outline" size="sm">
                            {automation.enabled ? "Pause" : "Turn on"}
                          </Button>
                        </form>
                        <form action={deleteAutomation}>
                          <input type="hidden" name="automationId" value={automation.id} />
                          <Button
                            type="submit"
                            variant="ghost"
                            size="icon-sm"
                            className="text-muted-foreground hover:text-destructive"
                            aria-label={`Delete ${automation.name}`}
                          >
                            <Trash2 />
                          </Button>
                        </form>
                      </div>
                    ) : null}
                  </div>

                  {/* The flow itself: trigger → action, read left to right. */}
                  <div className="flex flex-col gap-2 px-4 py-4 sm:flex-row sm:items-center sm:px-5">
                    <FlowStep
                      icon={Zap}
                      label="When"
                      value={triggerLabel(automation.triggerType, automation.triggerConfig)}
                    />
                    <ArrowRight
                      className="text-muted-foreground mx-auto size-4 shrink-0 rotate-90 sm:mx-0 sm:rotate-0"
                      aria-hidden
                    />
                    <FlowStep
                      icon={automation.actionType === "draft_follow_up" ? ShieldCheck : Workflow}
                      label="Then"
                      value={actionLabel(automation.actionType, automation.actionConfig)}
                    />
                  </div>

                  {canManage ? (
                    <div className="bg-surface-2/60 space-y-3 rounded-b-xl border-t px-4 py-3 sm:px-5">
                      <form action={runAutomationNow} className="flex flex-wrap items-end gap-2">
                        <input type="hidden" name="automationId" value={automation.id} />
                        <div className="min-w-52 flex-1 space-y-1.5">
                          <Label htmlFor={`run-lead-${automation.id}`}>Test on a lead</Label>
                          <NativeSelect
                            id={`run-lead-${automation.id}`}
                            name="leadId"
                            defaultValue=""
                            required
                            disabled={!automation.enabled || leads.length === 0}
                          >
                            <option value="" disabled>
                              {leads.length ? "Choose a lead" : "No leads yet"}
                            </option>
                            {leads.map((lead) => (
                              <option key={lead.id} value={lead.id}>
                                {lead.name}
                                {lead.company ? ` (${lead.company})` : ""}
                              </option>
                            ))}
                          </NativeSelect>
                        </div>
                        <Button
                          type="submit"
                          variant="outline"
                          disabled={!automation.enabled || leads.length === 0}
                        >
                          <PlayCircle />
                          Run now
                        </Button>
                      </form>

                      <details className="group">
                        <summary className="text-primary-soft-foreground cursor-pointer text-sm font-medium select-none">
                          Edit workflow
                        </summary>
                        <form action={updateAutomation} className="mt-3 grid gap-3 sm:grid-cols-2">
                          <input type="hidden" name="automationId" value={automation.id} />
                          <div className="space-y-1.5 sm:col-span-2">
                            <Label htmlFor={`edit-name-${automation.id}`}>Name</Label>
                            <Input
                              id={`edit-name-${automation.id}`}
                              name="name"
                              defaultValue={automation.name}
                              maxLength={120}
                              required
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor={`edit-trigger-${automation.id}`}>Trigger</Label>
                            <NativeSelect
                              id={`edit-trigger-${automation.id}`}
                              name="triggerType"
                              defaultValue={automation.triggerType}
                            >
                              <option value="lead.created">Lead created</option>
                              <option value="lead.status_changed">Lead status changed</option>
                            </NativeSelect>
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor={`edit-trigger-status-${automation.id}`}>
                              Only when status is
                            </Label>
                            <NativeSelect
                              id={`edit-trigger-status-${automation.id}`}
                              name="triggerStatus"
                              defaultValue={
                                typeof automation.triggerConfig.toStatus === "string"
                                  ? automation.triggerConfig.toStatus
                                  : ""
                              }
                            >
                              <option value="">Any status</option>
                              <StatusOptions />
                            </NativeSelect>
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor={`edit-action-${automation.id}`}>Action</Label>
                            <NativeSelect
                              id={`edit-action-${automation.id}`}
                              name="actionType"
                              defaultValue={automation.actionType}
                            >
                              <option value="notify_team">Notify owners and admins</option>
                              <option value="set_lead_status">Set lead status</option>
                              <option value="draft_follow_up">Prepare AI follow-up draft</option>
                            </NativeSelect>
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor={`edit-action-status-${automation.id}`}>
                              Set status to
                            </Label>
                            <NativeSelect
                              id={`edit-action-status-${automation.id}`}
                              name="actionStatus"
                              defaultValue={
                                typeof automation.actionConfig.status === "string"
                                  ? automation.actionConfig.status
                                  : ""
                              }
                            >
                              <option value="">Choose a status</option>
                              <StatusOptions />
                            </NativeSelect>
                          </div>
                          <label className="flex items-center gap-2 text-sm sm:col-span-2">
                            <input
                              name="email"
                              type="checkbox"
                              defaultChecked={automation.actionConfig.email === true}
                              className="accent-primary size-4"
                            />
                            Also email managers for notification actions
                          </label>
                          <div className="sm:col-span-2">
                            <Button type="submit" variant="outline" size="sm">
                              Save changes
                            </Button>
                          </div>
                        </form>
                      </details>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={<Workflow />}
              title="No workflows yet"
              description={
                canManage
                  ? "A workflow reacts when a lead arrives or changes status: notify a manager, move the lead, or prepare a follow-up draft for review."
                  : "Owners and admins can create workflows. They will appear here once one exists."
              }
            />
          )}
        </section>

        <aside aria-labelledby="new-heading" className="lg:sticky lg:top-20">
          <h2 id="new-heading" className="type-h2 mb-3">
            New automation
          </h2>
          <div className="bg-card rounded-xl border p-4 sm:p-5">
            {canManage ? (
              <form action={createAutomation} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="automation-name">Name</Label>
                  <Input
                    id="automation-name"
                    name="name"
                    placeholder="Follow up on every new lead"
                    maxLength={120}
                    required
                  />
                </div>
                <fieldset className="space-y-3">
                  <legend className="text-muted-foreground mb-2 flex items-center gap-1.5 text-sm font-medium">
                    <Zap className="size-3.5" aria-hidden /> When
                  </legend>
                  <div className="space-y-1.5">
                    <Label htmlFor="automation-trigger">Trigger</Label>
                    <NativeSelect
                      id="automation-trigger"
                      name="triggerType"
                      defaultValue="lead.created"
                    >
                      <option value="lead.created">Lead created</option>
                      <option value="lead.status_changed">Lead status changed</option>
                    </NativeSelect>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="automation-trigger-status">Only when status is</Label>
                    <NativeSelect
                      id="automation-trigger-status"
                      name="triggerStatus"
                      defaultValue=""
                    >
                      <option value="">Any status</option>
                      <StatusOptions />
                    </NativeSelect>
                  </div>
                </fieldset>
                <fieldset className="space-y-3 pt-1">
                  <legend className="text-muted-foreground mb-2 flex items-center gap-1.5 text-sm font-medium">
                    <Workflow className="size-3.5" aria-hidden /> Then
                  </legend>
                  <div className="space-y-1.5">
                    <Label htmlFor="automation-action">Action</Label>
                    <NativeSelect
                      id="automation-action"
                      name="actionType"
                      defaultValue="notify_team"
                    >
                      <option value="notify_team">Notify owners and admins</option>
                      <option value="set_lead_status">Set lead status</option>
                      <option value="draft_follow_up">Prepare AI follow-up draft</option>
                    </NativeSelect>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="automation-action-status">
                      Set status to (status action only)
                    </Label>
                    <NativeSelect id="automation-action-status" name="actionStatus" defaultValue="">
                      <option value="">Choose a status</option>
                      <StatusOptions />
                    </NativeSelect>
                  </div>
                  <label className="flex items-start gap-2 text-sm">
                    <input name="email" type="checkbox" className="accent-primary mt-0.5 size-4" />
                    Also email managers when the action is a notification
                  </label>
                </fieldset>
                <p className="text-muted-foreground flex gap-2 text-xs leading-relaxed">
                  <ShieldCheck
                    className="text-primary-soft-foreground mt-px size-4 shrink-0"
                    aria-hidden
                  />
                  AI follow-up automations prepare a draft only. Nothing is sent to a customer
                  automatically.
                </p>
                <Button type="submit" className="w-full">
                  Create automation
                </Button>
              </form>
            ) : (
              <p className="text-muted-foreground text-sm">
                Owners and admins can create or change automations. You can review workflows and run
                history.
              </p>
            )}
          </div>
        </aside>
      </div>

      <section aria-labelledby="runs-heading">
        <h2 id="runs-heading" className="type-h2 mb-3">
          Run history
        </h2>
        {runs.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Automation</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Result</TableHead>
                <TableHead className="text-right">Started</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.map((run) => (
                <TableRow key={run.id}>
                  <TableCell className="font-medium">
                    {names.get(run.automationId) ?? "Deleted automation"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={runVariant(run.status)}>{statusLabel(run.status)}</Badge>
                  </TableCell>
                  <TableCell
                    className={cn(
                      "max-w-md",
                      run.error ? "text-destructive" : "text-muted-foreground",
                    )}
                  >
                    {run.error ??
                      (Object.keys(run.result).length
                        ? Object.entries(run.result)
                            .map(([key, value]) => `${key}: ${String(value)}`)
                            .join(" · ")
                        : "Completed")}
                  </TableCell>
                  <TableCell className="text-muted-foreground num text-right whitespace-nowrap">
                    {new Intl.DateTimeFormat("en-CA", {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    }).format(new Date(run.startedAt))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <EmptyState
            icon={<BellRing />}
            title="No runs yet"
            description="Every run is recorded here with its result as soon as a matching lead event is processed."
          />
        )}
      </section>
    </>
  );
}

function FlowStep({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Zap;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-surface-2/70 flex min-w-0 flex-1 items-center gap-3 rounded-lg border px-3 py-2.5">
      <span
        aria-hidden
        className="bg-card text-primary-soft-foreground flex size-7 shrink-0 items-center justify-center rounded-md border"
      >
        <Icon className="size-3.5" />
      </span>
      <span className="min-w-0">
        <span className="text-muted-foreground block text-xs font-medium">{label}</span>
        <span className="block text-sm font-medium">{value}</span>
      </span>
    </div>
  );
}
