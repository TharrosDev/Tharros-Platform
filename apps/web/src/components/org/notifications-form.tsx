"use client";

import * as React from "react";
import { useActionState } from "react";

import { updateNotifications } from "@/lib/org/actions";
import { NOTIFICATION_OPTIONS, type Notifications } from "@/lib/org/schemas";
import { SaveButton } from "@/components/ui/save-button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { FormMessage } from "@/components/auth/auth-card";
import { useToast } from "@/components/ui/toast";

/**
 * Toggle the active org's notification preferences. Each switch submits "on"
 * when checked (and nothing when off), which the server action reads back into
 * a complete boolean map. Editable by owners/admins; disabled otherwise.
 */
export function NotificationsForm({
  defaults,
  canManage,
}: {
  defaults: Notifications;
  canManage: boolean;
}) {
  const [state, action, pending] = useActionState(updateNotifications, undefined);
  const toast = useToast();
  const lastHandled = React.useRef<typeof state>(null);

  React.useEffect(() => {
    if (state?.ok && state !== lastHandled.current) {
      lastHandled.current = state;
      toast.add({ title: "Notifications", description: state.message });
    }
  }, [state, toast]);

  return (
    <form action={action} className="space-y-6" noValidate>
      {state?.message && !state.ok ? <FormMessage>{state.message}</FormMessage> : null}

      <div className="divide-border divide-y">
        {NOTIFICATION_OPTIONS.map((option) => (
          <div key={option.key} className="flex items-start justify-between gap-4 py-4 first:pt-0">
            <div className="space-y-0.5">
              <Label htmlFor={`notif-${option.key}`}>{option.label}</Label>
              <p className="text-muted-foreground text-sm">{option.hint}</p>
            </div>
            <Switch
              id={`notif-${option.key}`}
              name={option.key}
              defaultChecked={defaults[option.key]}
              disabled={!canManage}
            />
          </div>
        ))}
      </div>

      {canManage ? <SaveButton pending={pending}>Save preferences</SaveButton> : null}
    </form>
  );
}
