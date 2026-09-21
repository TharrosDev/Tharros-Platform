"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useActionState } from "react";
import { CalendarClock, Send, Trash2, UserCog } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SaveButton } from "@/components/ui/save-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { FadeIn } from "@/components/motion";
import { FormMessage } from "@/components/auth/auth-card";
import { useToast } from "@/components/ui/toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  addTemporaryOverride,
  removeAvailabilityRow,
  requestAvailabilityNudge,
  savePermanentAvailability,
} from "@/lib/scheduling/actions";
import type { EmployeeAvailability } from "@/lib/scheduling/queries";
import { DAYS } from "@/components/scheduling/setup/model";

type PickEmployee = { id: string; name: string; email: string };

type DayState = { is_available: boolean; start_time: string; end_time: string };

export function AvailabilityManager({
  employees,
  selectedId,
  selectedName,
  availability,
  canManage,
}: {
  employees: PickEmployee[];
  selectedId: string | null;
  selectedName: string | null;
  availability: EmployeeAvailability | null;
  canManage: boolean;
}) {
  const router = useRouter();

  if (employees.length === 0) {
    return (
      <Empty
        title="No team members yet"
        body="Add your team in scheduling setup, then set their availability here."
      />
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="employee-picker">Team member</Label>
          <Select
            value={selectedId ?? ""}
            items={employees.map((e) => ({ value: e.id, label: e.name }))}
            onValueChange={(v) =>
              router.push(`/scheduling/availability?employee=${encodeURIComponent(String(v))}`)
            }
          >
            <SelectTrigger id="employee-picker" className="w-72">
              <SelectValue placeholder="Pick a team member…" />
            </SelectTrigger>
            <SelectContent>
              {employees.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedId && canManage ? (
          <RequestAvailabilityButton employeeId={selectedId} employeeName={selectedName} />
        ) : null}
      </div>

      {!selectedId || !availability ? (
        <Empty
          title="Pick a team member"
          body="Choose someone above to view and edit when they can work."
        />
      ) : (
        <div className="space-y-10">
          <WeeklyGrid
            key={`perm-${selectedId}`}
            employeeId={selectedId}
            employeeName={selectedName ?? "this person"}
            permanent={availability.permanent}
            canManage={canManage}
          />
          <TemporaryOverrides
            key={`temp-${selectedId}`}
            employeeId={selectedId}
            rows={availability.temporary}
            canManage={canManage}
            onChanged={() => router.refresh()}
          />
        </div>
      )}
    </div>
  );
}

/** Emails the employee a portal link to set their availability, then chases follow-ups. */
function RequestAvailabilityButton({
  employeeId,
  employeeName,
}: {
  employeeId: string;
  employeeName: string | null;
}) {
  const toast = useToast();
  const [requesting, startRequest] = React.useTransition();

  function request() {
    startRequest(async () => {
      const res = await requestAvailabilityNudge(employeeId);
      toast.add({
        title: res.error ? "Couldn't send request" : "Availability requested",
        description:
          res.error ?? `We emailed ${employeeName ?? "them"} a link to set their availability.`,
      });
    });
  }

  return (
    <Button type="button" variant="outline" onClick={request} disabled={requesting}>
      <Send className="size-4" aria-hidden />
      {requesting ? "Sending…" : "Request availability"}
    </Button>
  );
}

/* ------------------------------- Weekly grid -------------------------------- */

function WeeklyGrid({
  employeeId,
  employeeName,
  permanent,
  canManage,
}: {
  employeeId: string;
  employeeName: string;
  permanent: EmployeeAvailability["permanent"];
  canManage: boolean;
}) {
  const toast = useToast();
  const initial = React.useMemo<Record<number, DayState>>(() => {
    const map: Record<number, DayState> = {};
    for (const d of DAYS) map[d.value] = { is_available: false, start_time: "", end_time: "" };
    for (const row of permanent) {
      map[row.day_of_week] = {
        is_available: row.is_available,
        start_time: (row.start_time ?? "").slice(0, 5),
        end_time: (row.end_time ?? "").slice(0, 5),
      };
    }
    return map;
  }, [permanent]);

  // Remounted per employee via `key`, so initial state is always the right person's.
  const [grid, setGrid] = React.useState<Record<number, DayState>>(initial);

  const [state, action, pending] = useActionState(savePermanentAvailability, undefined);
  const handled = React.useRef<typeof state>(null);
  React.useEffect(() => {
    if (state?.ok && state !== handled.current) {
      handled.current = state;
      toast.add({ title: "Availability", description: state.message ?? "Saved." });
    }
  }, [state, toast]);

  const entries = DAYS.map((d) => ({
    day_of_week: d.value,
    is_available: grid[d.value].is_available,
    start_time: grid[d.value].is_available ? grid[d.value].start_time : "",
    end_time: grid[d.value].is_available ? grid[d.value].end_time : "",
  }));

  function patch(day: number, p: Partial<DayState>) {
    setGrid((g) => ({ ...g, [day]: { ...g[day], ...p } }));
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="employeeId" value={employeeId} />
      <input type="hidden" name="entries" value={JSON.stringify(entries)} />

      <div className="flex items-center gap-2">
        <CalendarClock className="text-muted-foreground size-5" />
        <h2 className="type-h2">Weekly availability</h2>
      </div>
      <p className="text-muted-foreground -mt-2 text-sm">
        Turn on the days {employeeName} can work. Leave the times blank for the whole day.
      </p>

      {state?.message && !state.ok ? <FormMessage>{state.message}</FormMessage> : null}

      <div className="rounded-xl bg-card divide-border divide-y border">
        {DAYS.map((d) => {
          const day = grid[d.value];
          return (
            <div
              key={d.value}
              data-on={day.is_available || undefined}
              className="data-[on]:bg-primary-soft/20 flex flex-wrap items-center gap-3 px-4 py-3 transition-colors"
            >
              <label className="flex w-40 items-center gap-3">
                <Switch
                  checked={day.is_available}
                  disabled={!canManage}
                  onCheckedChange={(on) => patch(d.value, { is_available: on })}
                />
                <span className="text-sm font-medium">{d.label}</span>
              </label>
              {day.is_available ? (
                <FadeIn rise={0} className="flex items-center gap-2">
                  <Input
                    type="time"
                    aria-label={`${d.label} from`}
                    value={day.start_time}
                    disabled={!canManage}
                    onChange={(e) => patch(d.value, { start_time: e.target.value })}
                    className="w-[7.5rem]"
                  />
                  <span className="text-muted-foreground text-sm">to</span>
                  <Input
                    type="time"
                    aria-label={`${d.label} to`}
                    value={day.end_time}
                    disabled={!canManage}
                    onChange={(e) => patch(d.value, { end_time: e.target.value })}
                    className="w-[7.5rem]"
                  />
                </FadeIn>
              ) : (
                <span className="text-muted-foreground text-sm">Not available</span>
              )}
            </div>
          );
        })}
      </div>

      {canManage ? <SaveButton pending={pending}>Save weekly availability</SaveButton> : null}
    </form>
  );
}

/* ----------------------------- Temporary overrides --------------------------- */

function TemporaryOverrides({
  employeeId,
  rows,
  canManage,
  onChanged,
}: {
  employeeId: string;
  rows: EmployeeAvailability["temporary"];
  canManage: boolean;
  onChanged: () => void;
}) {
  const toast = useToast();
  const [state, action, pending] = useActionState(addTemporaryOverride, undefined);
  const [removing, setRemoving] = React.useState<string | null>(null);
  const formRef = React.useRef<HTMLFormElement>(null);
  const handled = React.useRef<typeof state>(null);

  React.useEffect(() => {
    if (state?.ok && state !== handled.current) {
      handled.current = state;
      toast.add({ title: "Override added", description: state.message ?? "" });
      formRef.current?.reset();
      onChanged();
    }
  }, [state, toast, onChanged]);

  async function remove(id: string) {
    setRemoving(id);
    const res = await removeAvailabilityRow(id);
    setRemoving(null);
    if (res.error) {
      toast.add({ title: "Couldn't remove", description: res.error });
    } else {
      toast.add({ title: "Override removed", description: "" });
      onChanged();
    }
  }

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="type-h2">Date overrides</h2>
        <p className="text-muted-foreground text-sm">
          One-off exceptions: block a vacation, or open up an extra day. These win over the weekly
          pattern.
        </p>
      </div>

      {rows.length > 0 ? (
        <ul className="rounded-xl bg-card divide-border divide-y border">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <Badge variant={r.is_available ? "success" : "secondary"}>
                {r.is_available ? "Available" : "Unavailable"}
              </Badge>
              <span className="text-sm font-medium tabular-nums">
                {formatRange(r.effective_date, r.end_date)}
              </span>
              <span className="text-muted-foreground text-sm tabular-nums">
                {r.start_time && r.end_time
                  ? `${r.start_time.slice(0, 5)}–${r.end_time.slice(0, 5)}`
                  : "All day"}
              </span>
              {r.notes ? <span className="text-muted-foreground text-sm">· {r.notes}</span> : null}
              {canManage ? (
                <button
                  type="button"
                  onClick={() => remove(r.id)}
                  disabled={removing === r.id}
                  className="text-muted-foreground hover:text-destructive ml-auto inline-flex items-center gap-1 text-xs transition-colors disabled:opacity-50"
                >
                  <Trash2 className="size-3.5" /> {removing === r.id ? "Removing…" : "Remove"}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground text-sm">No date overrides yet.</p>
      )}

      {canManage ? (
        <form
          ref={formRef}
          action={action}
          className="rounded-xl bg-card grid gap-3 border p-4 sm:grid-cols-2"
        >
          <input type="hidden" name="employeeId" value={employeeId} />
          <Field label="Status">
            <Select name="is_available" defaultValue="false">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="false">Unavailable</SelectItem>
                <SelectItem value="true">Available</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <div className="hidden sm:block" />
          <Field label="From date">
            <Input type="date" name="effective_date" required />
          </Field>
          <Field label="To date (optional)">
            <Input type="date" name="end_date" />
          </Field>
          <Field label="From time (optional)">
            <Input type="time" name="start_time" />
          </Field>
          <Field label="To time (optional)">
            <Input type="time" name="end_time" />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Note (optional)">
              <Input
                name="notes"
                placeholder="e.g. Vacation, doctor's appointment"
                maxLength={300}
              />
            </Field>
          </div>
          {state?.message && !state.ok ? (
            <div className="sm:col-span-2">
              <FormMessage>{state.message}</FormMessage>
            </div>
          ) : null}
          <div className="sm:col-span-2">
            <Button type="submit" variant="outline" disabled={pending}>
              {pending ? "Adding…" : "Add override"}
            </Button>
          </div>
        </form>
      ) : null}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-1.5">
      <span className="text-muted-foreground text-xs font-medium">{label}</span>
      {children}
    </label>
  );
}

function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl bg-card flex flex-col items-center gap-2 border border-dashed px-6 py-14 text-center">
      <UserCog className="text-muted-foreground size-6" />
      <p className="font-medium">{title}</p>
      <p className="text-muted-foreground max-w-sm text-sm">{body}</p>
    </div>
  );
}

function formatRange(start: string, end: string | null): string {
  if (!end || end === start) return start;
  return `${start} → ${end}`;
}
