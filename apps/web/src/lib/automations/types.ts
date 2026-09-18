export const AUTOMATION_TRIGGERS = ["lead.created", "lead.status_changed"] as const;
export const AUTOMATION_ACTIONS = ["notify_team", "set_lead_status"] as const;

export type AutomationTrigger = (typeof AUTOMATION_TRIGGERS)[number];
export type AutomationAction = (typeof AUTOMATION_ACTIONS)[number];

export type Automation = {
  id: string;
  orgId: string;
  name: string;
  enabled: boolean;
  triggerType: AutomationTrigger;
  triggerConfig: Record<string, unknown>;
  actionType: AutomationAction;
  actionConfig: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type AutomationRun = {
  id: string;
  orgId: string;
  automationId: string;
  eventId: string | null;
  leadId: string | null;
  status: "running" | "succeeded" | "failed" | "skipped";
  result: Record<string, unknown>;
  error: string | null;
  startedAt: string;
  finishedAt: string | null;
  createdAt: string;
};
