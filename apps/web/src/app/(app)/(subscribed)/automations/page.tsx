import { redirect } from "next/navigation";
import { BellRing, PlayCircle, Sparkles, Trash2, Workflow } from "lucide-react";

import { getOrgContext } from "@/lib/org/queries";
import { listAutomations, listAutomationRuns } from "@/lib/automations/queries";
import { createAutomation, deleteAutomation, toggleAutomation } from "@/lib/automations/actions";
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
  searchParams: Promise<{ error?: string; created?: string }>;
}) {
  const [{ activeOrg }, params] = await Promise.all([getOrgContext(), searchParams]);
  if (!activeOrg) redirect("/dashboard");

  const [automations, runs] = await Promise.all([
    listAutomations(activeOrg.id),
    listAutomationRuns(activeOrg.id),
  ]);
  const canManage = activeOrg.role === "owner" || activeOrg.role === "admin";
  const names = new Map(automations.map((automation) => [automation.id, automation.name]));

  return (
    <>
      <PageHeader
        title="Automations"
        description="React to lead events with durable native workflows: notify managers, move pipeline status, or prepare AI follow-up drafts for human review."
      />

      {params.error ? (
        <div className="border-destructive/30 bg-destructive/10 text-destructive rounded-lg border px-4 py-3 text-sm">
          That automation could not be saved. Check the fields and your permissions.
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
        <Card>
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
                    className="border-input bg-card h-11 w-full rounded-lg border px-3.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40"
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
                    className="border-input bg-card h-11 w-full rounded-lg border px-3.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40"
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
                    className="border-input bg-card h-11 w-full rounded-lg border px-3.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40"
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
                    className="border-input bg-card h-11 w-full rounded-lg border px-3.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40"
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

        <Card>
          <CardHeader>
            <CardTitle>Workflows</CardTitle>
            <CardDescription>{automations.length} configured automations.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {automations.length ? (
              automations.map((automation) => (
                <div key={automation.id} className="bg-surface-2 rounded-xl border border-border/70 p-4">
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
                </div>
              ))
            ) : (
              <div className="bg-surface-2 rounded-xl border border-dashed p-8 text-center">
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
            <div className="bg-surface-2 rounded-lg border border-dashed p-7 text-center">
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
