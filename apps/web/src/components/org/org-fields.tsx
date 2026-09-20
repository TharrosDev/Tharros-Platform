"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FieldError } from "@/components/auth/auth-card";
import { INDUSTRY_OPTIONS, SIZE_OPTIONS, type OrgFormState } from "@/lib/org/schemas";

/**
 * The three shared business-identity fields (name, industry, size). Used by both
 * the first-run onboarding form and the "New organization" dialog.
 */
export function OrgFields({ state, autoFocus }: { state: OrgFormState; autoFocus?: boolean }) {
  return (
    <>
      <div className="space-y-1.5">
        <Label htmlFor="name">Business name</Label>
        <Input
          id="name"
          name="name"
          type="text"
          autoComplete="organization"
          autoFocus={autoFocus}
          defaultValue={state?.values?.name}
          aria-invalid={Boolean(state?.errors?.name)}
          aria-describedby={state?.errors?.name ? "name-error" : undefined}
          required
        />
        <FieldError id="name-error" message={state?.errors?.name?.[0]} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="industry">Industry</Label>
        <Select name="industry" defaultValue={state?.values?.industry ?? null}>
          <SelectTrigger id="industry" aria-invalid={Boolean(state?.errors?.industry)}>
            <SelectValue placeholder="Choose an industry" />
          </SelectTrigger>
          <SelectContent>
            {INDUSTRY_OPTIONS.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FieldError message={state?.errors?.industry?.[0]} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="size">Team size</Label>
        <Select name="size" defaultValue={state?.values?.size ?? null}>
          <SelectTrigger id="size" aria-invalid={Boolean(state?.errors?.size)}>
            <SelectValue placeholder="How many people?" />
          </SelectTrigger>
          <SelectContent>
            {SIZE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FieldError message={state?.errors?.size?.[0]} />
      </div>
    </>
  );
}
