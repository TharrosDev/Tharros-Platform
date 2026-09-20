"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarClock, Clock } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { FormMessage } from "@/components/auth/auth-card";
import { useToast } from "@/components/ui/toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateEmployeeProfile } from "@/lib/employees/profile-actions";
import type {
  AttendanceHistory,
  EmployeeProfile as Profile,
  EmploymentType,
} from "@/lib/employees/queries";
import type { RoleCertification } from "@/lib/scheduling/queries";
import type { HoursSummary } from "@/lib/employees/hours";
import type { EmployeeProfileInput } from "@/lib/employees/schemas";

import { RoleManager } from "./role-manager";

const EMPLOYMENT_LABEL: Record<EmploymentType, string> = {
  full_time: "Full-time",
  part_time: "Part-time",
  casual: "Casual",
  contract: "Contract",
};

function numStr(n: number | null): string {
  return n === null ? "" : String(n);
}

export function EmployeeProfile({
  profile,
  catalog,
  hours,
  attendance,
  availableDays,
  canManage,
}: {
  profile: Profile;
  catalog: RoleCertification[];
  hours: HoursSummary;
  attendance: AttendanceHistory;
  availableDays: number;
  canManage: boolean;
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <ProfileForm profile={profile} canManage={canManage} />
        <RoleManager
          employeeId={profile.id}
          roles={profile.roles}
          catalog={catalog}
          canManage={canManage}
        />
      </div>
      <div className="space-y-6">
        <HoursCard hours={hours} />
        <AvailabilityCard employeeId={profile.id} availableDays={availableDays} />
        <AttendanceCard attendance={attendance} />
      </div>
    </div>
  );
}

/* ------------------------------- profile form ------------------------------ */

function ProfileForm({ profile, canManage }: { profile: Profile; canManage: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  const [form, setForm] = React.useState<EmployeeProfileInput>({
    employment_type: profile.employmentType,
    phone: profile.phone ?? "",
    seniority_rank: profile.seniorityRank ?? undefined,
    hire_date: profile.hireDate ?? "",
    is_minor: profile.isMinor,
    target_hours_weekly: profile.targetHoursWeekly ?? undefined,
    min_hours_weekly: profile.minHoursWeekly ?? undefined,
    max_hours_weekly: profile.maxHoursWeekly ?? undefined,
    performance_score: profile.performanceScore ?? undefined,
    notes: profile.notes ?? "",
  });

  function patch(p: Partial<EmployeeProfileInput>) {
    setForm((f) => ({ ...f, ...p }));
  }
  function numField(key: keyof EmployeeProfileInput, value: string) {
    patch({ [key]: value === "" ? undefined : Number(value) } as Partial<EmployeeProfileInput>);
  }

  function save() {
    setError(null);
    start(async () => {
      const res = await updateEmployeeProfile(profile.id, form);
      if (!res.ok) {
        setError(res.message);
        return;
      }
      toast.add({ title: "Profile", description: "Saved." });
      router.refresh();
    });
  }

  const disabled = !canManage;

  return (
    <section className="bg-card space-y-4 border p-5">
      <h2 className="text-sm font-medium">Employment</h2>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Employment type">
          <Select
            value={form.employment_type}
            onValueChange={(v) => patch({ employment_type: (v as EmploymentType) ?? "part_time" })}
            disabled={disabled}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(EMPLOYMENT_LABEL) as EmploymentType[]).map((t) => (
                <SelectItem key={t} value={t}>
                  {EMPLOYMENT_LABEL[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Phone">
          <Input
            value={form.phone ?? ""}
            disabled={disabled}
            onChange={(e) => patch({ phone: e.target.value })}
            placeholder="(613) 555-0199"
          />
        </Field>
        <Field label="Hire date">
          <Input
            type="date"
            value={form.hire_date ?? ""}
            disabled={disabled}
            onChange={(e) => patch({ hire_date: e.target.value })}
          />
        </Field>
        <Field label="Seniority rank" hint="Lower number ranks as more senior.">
          <Input
            type="number"
            value={numStr(form.seniority_rank ?? null)}
            disabled={disabled}
            onChange={(e) => numField("seniority_rank", e.target.value)}
          />
        </Field>
        <Field label="Target hours / week">
          <Input
            type="number"
            value={numStr(form.target_hours_weekly ?? null)}
            disabled={disabled}
            onChange={(e) => numField("target_hours_weekly", e.target.value)}
          />
        </Field>
        <Field label="Performance score" hint="A number from 0 to 100.">
          <Input
            type="number"
            value={numStr(form.performance_score ?? null)}
            disabled={disabled}
            onChange={(e) => numField("performance_score", e.target.value)}
          />
        </Field>
        <Field label="Min hours / week">
          <Input
            type="number"
            value={numStr(form.min_hours_weekly ?? null)}
            disabled={disabled}
            onChange={(e) => numField("min_hours_weekly", e.target.value)}
          />
        </Field>
        <Field label="Max hours / week">
          <Input
            type="number"
            value={numStr(form.max_hours_weekly ?? null)}
            disabled={disabled}
            onChange={(e) => numField("max_hours_weekly", e.target.value)}
          />
        </Field>
      </div>

      <label className="flex items-center gap-3">
        <Switch
          checked={form.is_minor}
          disabled={disabled}
          onCheckedChange={(on) => patch({ is_minor: on === true })}
        />
        <span className="text-sm font-medium">Minor (applies minor labor rules)</span>
      </label>

      <Field label="Notes">
        <Textarea
          value={form.notes ?? ""}
          disabled={disabled}
          rows={3}
          maxLength={2000}
          onChange={(e) => patch({ notes: e.target.value })}
          placeholder="Anything the scheduler should know."
        />
      </Field>

      {error ? <FormMessage>{error}</FormMessage> : null}
      {canManage ? (
        <Button type="button" onClick={save} disabled={pending}>
          {pending ? "Saving…" : "Save profile"}
        </Button>
      ) : null}
    </section>
  );
}

/* --------------------------------- cards ----------------------------------- */

function HoursCard({ hours }: { hours: HoursSummary }) {
  return (
    <section className="bg-card space-y-3 border p-5">
      <div className="flex items-center gap-2">
        <Clock className="text-muted-foreground size-5" />
        <h2 className="text-sm font-medium">Hours worked</h2>
      </div>
      <p className="text-2xl font-semibold tabular-nums">{hours.totalHours}h</p>
      <p className="text-muted-foreground text-xs">Published shifts, last 4 weeks.</p>
      {hours.weeks.length > 0 ? (
        <ul className="divide-border divide-y text-sm">
          {hours.weeks.map((w) => (
            <li key={w.week} className="flex justify-between py-1.5">
              <span className="text-muted-foreground tabular-nums">{w.week}</span>
              <span className="tabular-nums">{w.hours}h</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground text-sm">No published shifts in this window.</p>
      )}
    </section>
  );
}

function AvailabilityCard({
  employeeId,
  availableDays,
}: {
  employeeId: string;
  availableDays: number;
}) {
  return (
    <section className="bg-card space-y-3 border p-5">
      <div className="flex items-center gap-2">
        <CalendarClock className="text-muted-foreground size-5" />
        <h2 className="text-sm font-medium">Availability</h2>
      </div>
      <p className="text-sm">
        {availableDays > 0
          ? `Available ${availableDays} day${availableDays > 1 ? "s" : ""} a week.`
          : "No weekly availability set."}
      </p>
      <Link
        href={`/scheduling/availability?employee=${encodeURIComponent(employeeId)}`}
        className={buttonVariants({ variant: "outline", size: "sm" })}
      >
        Manage availability
      </Link>
    </section>
  );
}

function AttendanceCard({ attendance }: { attendance: AttendanceHistory }) {
  const { timeOff, sickCalls, swaps } = attendance;
  const empty = timeOff.length === 0 && sickCalls.length === 0 && swaps.length === 0;
  return (
    <section className="bg-card space-y-3 border p-5">
      <h2 className="text-sm font-medium">Attendance history</h2>
      {empty ? (
        <p className="text-muted-foreground text-sm">
          No time-off, sick-calls, or swaps yet. These appear here as they happen.
        </p>
      ) : (
        <div className="space-y-3 text-sm">
          {sickCalls.length > 0 ? (
            <div>
              <p className="text-muted-foreground mb-1 text-xs font-medium uppercase">Sick-calls</p>
              <ul className="space-y-1">
                {sickCalls.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-2">
                    <span className="tabular-nums">{s.reportedAt.slice(0, 10)}</span>
                    <Badge variant="outline">{s.status}</Badge>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {timeOff.length > 0 ? (
            <div>
              <p className="text-muted-foreground mb-1 text-xs font-medium uppercase">Time off</p>
              <ul className="space-y-1">
                {timeOff.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-2">
                    <span className="tabular-nums">
                      {t.startDate}
                      {t.endDate !== t.startDate ? ` → ${t.endDate}` : ""}
                    </span>
                    <Badge variant="outline">{t.status}</Badge>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {swaps.length > 0 ? (
            <div>
              <p className="text-muted-foreground mb-1 text-xs font-medium uppercase">Swaps</p>
              <ul className="space-y-1">
                {swaps.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-2">
                    <span className="tabular-nums">{s.createdAt.slice(0, 10)}</span>
                    <Badge variant="outline">{s.status}</Badge>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="space-y-1.5">
      <span className="block text-xs font-medium">{label}</span>
      {children}
      {hint ? <span className="text-muted-foreground block text-xs">{hint}</span> : null}
    </label>
  );
}
