import type { AutomationTrigger } from "@/lib/automations/types";

export function matchesAutomationEvent(input: {
  manual: boolean;
  eventType: string;
  eventData: Record<string, unknown> | null;
  triggerType: AutomationTrigger;
  triggerConfig: Record<string, unknown> | null;
}): boolean {
  if (input.manual) return true;
  if (input.triggerType !== input.eventType) return false;

  if (input.triggerType === "lead.status_changed") {
    const toStatus = input.triggerConfig?.toStatus;
    if (typeof toStatus === "string") {
      return input.eventData?.to === toStatus;
    }
  }

  return true;
}
