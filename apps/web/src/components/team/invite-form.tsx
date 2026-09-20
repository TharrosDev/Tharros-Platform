"use client";

import * as React from "react";
import { useActionState } from "react";

import { sendInvite } from "@/lib/team/actions";
import { INVITE_ROLE_OPTIONS } from "@/lib/team/schemas";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SaveButton } from "@/components/ui/save-button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FieldError, FormMessage } from "@/components/auth/auth-card";
import { useToast } from "@/components/ui/toast";

/** Invite a teammate by email at member/admin. Owner/admin only (gated upstream). */
export function InviteForm() {
  const [state, action, pending] = useActionState(sendInvite, undefined);
  const toast = useToast();
  const formRef = React.useRef<HTMLFormElement>(null);
  const lastHandled = React.useRef<TeamFormStateMarker>(null);

  // Toast + reset on a successful send (only once per new state object).
  React.useEffect(() => {
    if (state?.ok && state !== lastHandled.current) {
      lastHandled.current = state as TeamFormStateMarker;
      toast.add({ title: "Invite", description: state.message });
      formRef.current?.reset();
    }
  }, [state, toast]);

  return (
    <form ref={formRef} action={action} className="space-y-4" noValidate>
      {state?.message && !state.ok ? <FormMessage>{state.message}</FormMessage> : null}

      <div className="grid gap-4 sm:grid-cols-[1fr_auto_auto] sm:items-start">
        <div className="space-y-1.5">
          <Label htmlFor="invite-email">Email</Label>
          <Input
            id="invite-email"
            name="email"
            type="email"
            autoComplete="off"
            placeholder="teammate@business.ca"
            defaultValue={state?.values?.email}
            aria-invalid={Boolean(state?.errors?.email)}
            required
          />
          <FieldError message={state?.errors?.email?.[0]} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="invite-role">Role</Label>
          <Select name="role" defaultValue="member">
            <SelectTrigger
              id="invite-role"
              className="sm:w-40"
              aria-invalid={Boolean(state?.errors?.role)}
            >
              <SelectValue placeholder="Role" />
            </SelectTrigger>
            <SelectContent>
              {INVITE_ROLE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldError message={state?.errors?.role?.[0]} />
        </div>

        <div className="space-y-1.5">
          <Label className="hidden sm:block">&nbsp;</Label>
          <SaveButton pending={pending} pendingLabel="Sending…" className="w-full sm:w-auto">
            Send invite
          </SaveButton>
        </div>
      </div>
    </form>
  );
}

// Local marker type so the effect can dedupe on the state object identity.
type TeamFormStateMarker = { ok?: boolean; message?: string } | null;
