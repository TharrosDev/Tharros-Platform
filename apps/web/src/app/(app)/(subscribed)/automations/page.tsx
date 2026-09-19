import { redirect } from "next/navigation";
import { BellRing, PlayCircle, Sparkles, Trash2, Workflow } from "lucide-react";

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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

function triggerLabel(type: string, config: Record<string, unknown>) {
  if (type === "lead.created") return "When a lead is created";
  return typeof config.toStatus === "string"
    ? `When a lead becomes ${config.toStatus}`
    : "When a lead status changes";
}

function actionLabel(type: string, config: Record<string, unknown>) {
  if (type === "notify_team") return config.email === true ? "Notify managers + email" : "Notify managers";
  if (type === "draft_follow_up") return "Prepare an AI follow-up draft";
  return typeof config.status === "string" ? `Set lead status to ${config.status}` : "Set lead status";
}

function runVariant(status: string) {
  if (status === "succeeded") return "success" as const;
  if (status === "failed") return "destructive" as const;
  if (status === "running") return "info" as const;
  return "secondary" as const;
}

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
        description="React to lead events with durable native workflows: notify managers, move pipeline status, or prepare AI follow-up drafts for human review."
      />

      {params.queued ? (
        <div className="border-success/30 bg-success/10 text-success rounded-lg border px-4 py-3 text-sm">
          Workflow queued. Its result will appear in Recent runs after the jobs worker processes it.
        </div>
      ) : null}

      {params.error ? (
        <div className="border-destructive/30 bg-destructive/10 text-destructive rounded-lg border px-4 py-3 text-sm">
          That automation could not be saved. Check the fields and your permissions.
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
        <Card className="visual-panel-strong">
          <CardHeader>
            <CardTitle>Create automation</CardTitle>
            <CardDescription>
              Workflows execute on the same durable queue as scheduling jobs and record every run.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {canManage ? (
              <form action={createAutomation} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="automation-name">Name</Label>
                  <Input
                    id="automation-name"
                    name="name"
                    placeholder="Draft a follow-up for every new lead"
                    maxLength={120}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="automation-trigger">Trigger</Label>
                  <select
                    id="automation-trigger"
                    name="triggerType"
                    className="border-input bg-card/80 h-11 w-full rounded-xl border px-3.5 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[4px] focus-visible:ring-ring/30"
                    defaultValue="lead.created"
                  >
                    <option value="lead.created">Lead created</option>
                    <option value="lead.status_changed">Lead status changed</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="automation-trigger-status">Optional status filter</Label>
                  <select
                    id="automation-trigger-status"
                    name="triggerStatus"
                    className="border-input bg-card/80 h-11 w-full rounded-xl border px-3.5 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[4px] focus-visible:ring-ring/30"
                    defaultValue=""
                  >
                    <option value="">Any status</option>
                    {LEAD_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="automation-action">Action</Label>
                  <select
                    id="automation-action"
                    name="actionType"
                    className="border-input bg-card/80 h-11 w-full rounded-xl border px-3.5 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[4px] focus-visible:ring-ring/30"
                    defaultValue="notify_team"
                  >
                    <option value="notify_team">Notify owners/admins</option>
                    <option value="set_lead_status">Set lead status</option>
                    <option value="draft_follow_up">Prepare AI follow-up draft</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="automation-action-status">Target status (for status action)</Label>
                  <select
                    id="automation-action-status"
                    name="actionStatus"
                    className="border-input bg-card/80 h-11 w-full rounded-xl border px-3.5 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[4px] focus-visible:ring-ring/30"
                    defaultValue=""
                  >
                    <option value="">Choose a status</option>
                    {LEAD_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </div>

                <label className="flex items-center gap-2 text-sm">
                  <input name="email" type="checkbox" className="size-4 rounded border-input" />
                  Also email managers when using the notification action
                </label>

                <div className="bg-primary-soft/30 text-muted-foreground flex gap-2 rounded-lg p-3 text-xs">
                  <Sparkles className="text-primary mt-0.5 size-4 shrink-0" />
                  AI follow-up automations prepare a draft only. They never send customer email automatically.
                </div>

                <Button type="submit" className="w-full">
                  <Workflow />
                  Create automation
                </Button>
              </form>
            ) : (
              <p className="text-muted-foreground text-sm">
                Owners and admins can create or change automations. You can review workflows and run history.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden bg-gradient-to-b from-card to-primary-soft/10">
          <CardHeader>
            <CardTitle>Workflows</CardTitle>
            <CardDescription>{automations.length} configured automations.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {automations.length ? (
              automations.map((automation) => (
                <div key={automation.id} className="bg-surface-2/75 rounded-2xl border border-border/70 p-4 shadow-xs transition-[border-color,transform] hover:-translate-y-px hover:border-primary/15">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{automation.name}</p>
                        <Badge variant={automation.enabled ? "success" : "secondary"}>
                          {automation.enabled ? "On" : "Paused"}
                        </Badge>
                      </div>
                      <p className="text-muted-foreground type-small mt-2">
                        {triggerLabel(automation.triggerType, automation.triggerConfig)}
                      </p>
                      <p className="text-muted-foreground type-small">
                        {actionLabel(automation.actionType, automation.actionConfig)}
                      </p>
                    </div>
                    {canManage ? (
                      <div className="flex gap-2">
                        <form action={toggleAutomation}>
                          <input type="hidden" name="automationId" value={automation.id} />
                          <input
                            type="hidden"
                            name="enabled"
                            value={automation.enabled ? "false" : "true"}
                          />
                          <Button type="submit" variant="outline" size="sm">
                            {automation.enabled ? "Pause" : "Enable"}
                          </Button>
                        </form>
                        <form action={deleteAutomation}>
                          <input type="hidden" name="automationId" value={automation.id} />
                          <Button type="submit" variant="ghost" size="sm" aria-label={`Delete ${automation.name}`}>
                            <Trash2 />
                          </Button>
                        </form>
                      </div>
                    ) : null}
                  </div>

                  {canManage ? (
                    <details className="mt-4 border-t border-border/70 pt-4">
                      <summary className="text-primary cursor-pointer text-xs font-medium">
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
                          <select
                            id={`edit-trigger-${automation.id}`}
                            name="triggerType"
                            defaultValue={automation.triggerType}
                            className="border-input bg-card/80 h-10 w-full rounded-lg border px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[4px] focus-visible:ring-ring/30"
                          >
                            <option value="lead.created">Lead created</option>
                            <option value="lead.status_changed">Lead status changed</option>
                          </select>
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor={`edit-trigger-status-${automation.id}`}>Status filter</Label>
                          <select
                            id={`edit-trigger-status-${automation.id}`}
                            name="triggerStatus"
                            defaultValue={
                              typeof automation.triggerConfig.toStatus === "string"
                                ? automation.triggerConfig.toStatus
                                : ""
                            }
                            className="border-input bg-card/80 h-10 w-full rounded-lg border px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[4px] focus-visible:ring-ring/30"
                          >
                            <option value="">Any status</option>
                            {LEAD_STATUSES.map((status) => (
                              <option key={status} value={status}>{status}</option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor={`edit-action-${automation.id}`}>Action</Label>
                          <select
                            id={`edit-action-${automation.id}`}
                            name="actionType"
                            defaultValue={automation.actionType}
                            className="border-input bg-card/80 h-10 w-full rounded-lg border px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[4px] focus-visible:ring-ring/30"
                          >
                            <option value="notify_team">Notify owners/admins</option>
                            <option value="set_lead_status">Set lead status</option>
                            <option value="draft_follow_up">Prepare AI follow-up draft</option>
                          </select>
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor={`edit-action-status-${automation.id}`}>Target status</Label>
                          <select
                            id={`edit-action-status-${automation.id}`}
                            name="actionStatus"
                            defaultValue={
                              typeof automation.actionConfig.status === "string"
                                ? automation.actionConfig.status
                                : ""
                            }
                            className="border-input bg-card/80 h-10 w-full rounded-lg border px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[4px] focus-visible:ring-ring/30"
                          >
                            <option value="">Choose a status</option>
                            {LEAD_STATUSES.map((status) => (
                              <option key={status} value={status}>{status}</option>
                            ))}
                          </select>
                        </div>
                        <label className="flex items-center gap-2 text-sm sm:col-span-2">
                          <input
                            name="email"
                            type="checkbox"
                            defaultChecked={automation.actionConfig.email === true}
                            className="size-4 rounded border-input"
                          />
                          Email managers for notification actions
                        </label>
                        <div className="sm:col-span-2">
                          <Button type="submit" variant="outline" size="sm">
                            Save workflow
                          </Button>
                        </div>
                      </form>
                    </details>
                  ) : null}

                  {canManage ? (
                    <form action={runAutomationNow} className="mt-4 flex flex-wrap items-end gap-2 border-t border-border/70 pt-4">
                      <input type="hidden" name="automationId" value={automation.id} />
                      <div className="min-w-56 flex-1 space-y-1.5">
                        <Label htmlFor={`run-lead-${automation.id}`}>Run now on lead</Label>
                        <select
                          id={`run-lead-${automation.id}`}
                          name="leadId"
                          className="border-input bg-card/80 h-9 w-full rounded-lg border px-2.5 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[4px] focus-visible:ring-ring/30"
                          defaultValue=""
                          required
                          disabled={!automation.enabled || leads.length === 0}
                        >
                          <option value="" disabled>
                            {leads.length ? "Choose a lead" : "No leads available"}
                          </option>
                          {leads.map((lead) => (
                            <option key={lead.id} value={lead.id}>
                              {lead.name}{lead.company ? ` — ${lead.company}` : ""}
                            </option>
                          ))}
                        </select>
                      </div>
                      <Button
                        type="submit"
                        variant="outline"
                        size="sm"
                        disabled={!automation.enabled || leads.length === 0}
                      >
                        <PlayCircle />
                        Run now
                      </Button>
                    </form>
                  ) : null}
                </div>
              ))
            ) : (
              <div className="bg-surface-2/70 rounded-2xl border border-dashed border-border/80 p-8 text-center shadow-inner">
                <Workflow className="text-muted-foreground mx-auto size-5" />
                <p className="mt-2 text-sm font-medium">No automations yet</p>
                <p className="text-muted-foreground type-small mt-1">
                  Create a workflow to react automatically when leads arrive or change state.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PlayCircle className="size-4" />
            Recent runs
          </CardTitle>
          <CardDescription>Durable execution history for your native workflows.</CardDescription>
        </CardHeader>
        <CardContent>
          {runs.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Automation</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Result</TableHead>
                  <TableHead>Started</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((run) => (
                  <TableRow key={run.id}>
                    <TableCell className="font-medium">
                      {names.get(run.automationId) ?? "Deleted automation"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={runVariant(run.status)}>{run.status}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {run.error ??
                        (Object.keys(run.result).length
                          ? Object.entries(run.result)
                              .map(([key, value]) => `${key}: ${String(value)}`)
                              .join(" · ")
                          : "Completed")}
                    </TableCell>
                    <TableCell>
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
            <div className="bg-surface-2/70 rounded-2xl border border-dashed border-border/80 p-7 text-center shadow-inner">
              <BellRing className="text-muted-foreground mx-auto size-5" />
              <p className="mt-2 text-sm font-medium">No runs yet</p>
              <p className="text-muted-foreground type-small mt-1">
                Runs appear here after a matching lead event is dispatched.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
