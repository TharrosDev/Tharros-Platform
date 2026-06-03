"use client";

import * as React from "react";
import { useActionState } from "react";

import { createEmployee } from "@/lib/employees/actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { FieldError, FormMessage } from "@/components/auth/auth-card";
import { useToast } from "@/components/ui/toast";

/** Add an account-less employee to the roster. Owner/admin only (gated upstream). */
export function EmployeeForm() {
  const [state, action, pending] = useActionState(createEmployee, undefined);
  const toast = useToast();
  const formRef = React.useRef<HTMLFormElement>(null);
  const lastHandled = React.useRef<EmployeeFormStateMarker>(null);

  React.useEffect(() => {
    if (state?.ok && state !== lastHandled.current) {
      lastHandled.current = state as EmployeeFormStateMarker;
      toast.add({ title: "Employee added", description: state.message });
      formRef.current?.reset();
    }
  }, [state, toast]);

  return (
    <form ref={formRef} action={action} className="space-y-4" noValidate>
      {state?.message && !state.ok ? <FormMessage>{state.message}</FormMessage> : null}

      <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-start">
        <div className="space-y-1.5">
          <Label htmlFor="employee-name">Name</Label>
          <Input
            id="employee-name"
            name="name"
            autoComplete="off"
            placeholder="Sam Rivera"
            defaultValue={state?.values?.name}
            aria-invalid={Boolean(state?.errors?.name)}
            required
          />
          <FieldError message={state?.errors?.name?.[0]} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="employee-email">Email</Label>
          <Input
            id="employee-email"
            name="email"
            type="email"
            autoComplete="off"
            placeholder="sam@business.ca"
            defaultValue={state?.values?.email}
            aria-invalid={Boolean(state?.errors?.email)}
            required
          />
          <FieldError message={state?.errors?.email?.[0]} />
        </div>

        <div className="space-y-1.5">
          <Label className="hidden sm:block">&nbsp;</Label>
          <Button type="submit" disabled={pending} className="w-full sm:w-auto">
            {pending ? "Adding…" : "Add employee"}
          </Button>
        </div>
      </div>
    </form>
  );
}

type EmployeeFormStateMarker = { ok?: boolean; message?: string } | null;
