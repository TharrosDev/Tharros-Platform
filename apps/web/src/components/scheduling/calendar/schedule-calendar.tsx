"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeftRight,
  CalendarClock,
  CalendarRange,
  CheckCircle2,
  Clock,
  History,
  Lock,
  LockOpen,
  Plus,
  TriangleAlert,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { FormMessage } from "@/components/auth/auth-card";
import { useToast } from "@/components/ui/toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  addShift,
  approveSwap,
  approveTimeOff,
  assignShift,
  deleteShift,
  denySwap,
  denyTimeOff,
  findReplacement,
  generateDraftSchedule,
  publishSchedule,
  reopenSchedule,
  reverseTimeOff,
  toggleShiftLock,
  updateShiftTimes,
} from "@/lib/scheduling/calendar-actions";
import type { PendingTimeOff } from "@/lib/scheduling/time-off";
import type {
  AuditEntry,
  CalendarShift,
  DraftSchedule,
  EscalatedSwap,
  RoleCertification,
} from "@/lib/scheduling/queries";
import {
  validateEdits,
  type EditShift,
  type EditViolation,
  type ValidationContext,
} from "@/lib/scheduling/validation";

const WINDOW_DAYS = 14;
const OPEN_ROW = "__open__";
/** Select sentinels — Base UI reserves "" for the placeholder, so use real tokens. */
const UNASSIGNED = "__unassigned__";
const ANY_ROLE = "__any__";
const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type Employee = { id: string; name: string };

/* ----------------------------- date/time helpers ---------------------------- */

function dateOf(iso: string): string {
  return iso.slice(0, 10);
}
function timeOf(iso: string): string {
  return iso.slice(11, 16);
}
function isoOf(date: string, time: string): string {
  return `${date}T${time}:00Z`;
}
function addDays(date: string, n: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
}
function weekdayOf(date: string): number {
  return new Date(Date.parse(`${date}T00:00:00Z`)).getUTCDay();
}
function shortDate(date: string): string {
  return `${WEEKDAY[weekdayOf(date)]} ${Number(date.slice(8, 10))}`;
}
function toEditShift(s: CalendarShift): EditShift {
  return {
    id: s.id,
    employeeId: s.employeeId,
    roleId: s.roleId,
    startsAt: s.startsAt,
    endsAt: s.endsAt,
    breakMinutes: s.breakMinutes,
  };
}

/* --------------------------------- component -------------------------------- */

export function ScheduleCalendar({
  schedule,
  shifts: initialShifts,
  employees,
  roles,
  validation,
  auditTrail,
  canManage,
  escalatedSwaps = [],
  timeOffRequests = [],
}: {
  schedule: DraftSchedule | null;
  shifts: CalendarShift[];
  employees: Employee[];
  roles: RoleCertification[];
  validation: ValidationContext | null;
  auditTrail: AuditEntry[];
  canManage: boolean;
  escalatedSwaps?: EscalatedSwap[];
  timeOffRequests?: PendingTimeOff[];
}) {
  // Server truth: edits persist via server actions, then `router.refresh()` re-runs
  // the page and feeds fresh props — no local mirror of the shift list to drift.
  const shifts = initialShifts;

  const [windowStart, setWindowStart] = React.useState(schedule?.periodStart ?? "");
  const [editing, setEditing] = React.useState<CalendarShift | null>(null);
  const [adding, setAdding] = React.useState<{ day: string; employeeId: string | null } | null>(
    null,
  );
  const [showHistory, setShowHistory] = React.useState(false);
  const [showSwaps, setShowSwaps] = React.useState(false);
  const [showTimeOff, setShowTimeOff] = React.useState(false);
  const pendingTimeOffCount = timeOffRequests.filter((r) => r.status === "pending").length;

  const roleName = React.useMemo(() => new Map(roles.map((r) => [r.id, r.name])), [roles]);

  // Live validation over the whole board → per-shift + totals.
  const boardViolations = React.useMemo<EditViolation[]>(
    () => (validation ? validateEdits(shifts.map(toEditShift), validation) : []),
    [shifts, validation],
  );
  const byShift = React.useMemo(() => {
    const map = new Map<string, EditViolation[]>();
    for (const v of boardViolations) {
      if (!v.shiftId) continue;
      const list = map.get(v.shiftId);
      if (list) list.push(v);
      else map.set(v.shiftId, [v]);
    }
    return map;
  }, [boardViolations]);
  const hardCount = boardViolations.filter((v) => v.severity === "hard").length;
  const softCount = boardViolations.length - hardCount;

  if (!schedule) {
    return <EmptyState canManage={canManage} />;
  }

  const isDraft = schedule.status === "draft";
  const isPublished = schedule.status === "published";
  const editable = canManage && isDraft;
  const openShiftCount = shifts.filter((s) => s.employeeId === null).length;

  const days = Array.from({ length: WINDOW_DAYS }, (_, i) => addDays(windowStart, i));
  const windowEnd = days[days.length - 1];

  // shifts[employeeId|OPEN_ROW][date] → CalendarShift[]
  function cellShifts(rowKey: string, day: string): CalendarShift[] {
    return shifts.filter(
      (s) => (s.employeeId ?? OPEN_ROW) === rowKey && dateOf(s.startsAt) === day,
    );
  }

  const rows: Array<{ key: string; name: string }> = [
    ...employees.map((e) => ({ key: e.id, name: e.name })),
    { key: OPEN_ROW, name: "Open shifts" },
  ];

  return (
    <div className="space-y-5">
      {/* Header row: period nav + validation summary + actions */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setWindowStart(addDays(windowStart, -WINDOW_DAYS))}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setWindowStart(addDays(windowStart, WINDOW_DAYS))}
          >
            Next
          </Button>
          <span className="text-muted-foreground ml-1 text-sm tabular-nums">
            {windowStart} – {windowEnd}
          </span>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-x-3 gap-y-2">
          <div className="flex items-center gap-2">
            {isPublished ? (
              <Badge variant="success">
                <CheckCircle2 className="size-3.5" aria-hidden /> Published
                {schedule.publishedAt ? ` ${schedule.publishedAt.slice(0, 10)}` : ""}
              </Badge>
            ) : (
              <Badge variant="secondary">Draft</Badge>
            )}
            {hardCount > 0 ? (
              <Badge variant="destructive">
                <TriangleAlert className="size-3.5" aria-hidden /> {hardCount} to fix
              </Badge>
            ) : softCount > 0 || openShiftCount > 0 ? (
              <Badge variant="warning">
                {[
                  openShiftCount > 0 ? `${openShiftCount} open` : null,
                  softCount > 0 ? `${softCount} warning${softCount > 1 ? "s" : ""}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </Badge>
            ) : (
              <Badge variant="success">All covered</Badge>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowHistory(true)}>
              <History className="size-4" /> History
            </Button>
            {canManage && escalatedSwaps.length > 0 ? (
              <Button variant="outline" size="sm" onClick={() => setShowSwaps(true)}>
                <ArrowLeftRight className="size-4" /> Swaps
                <Badge variant="warning" className="ml-1">
                  {escalatedSwaps.length}
                </Badge>
              </Button>
            ) : null}
            {canManage && timeOffRequests.length > 0 ? (
              <Button variant="outline" size="sm" onClick={() => setShowTimeOff(true)}>
                <CalendarClock className="size-4" /> Time off
                {pendingTimeOffCount > 0 ? (
                  <Badge variant="warning" className="ml-1">
                    {pendingTimeOffCount}
                  </Badge>
                ) : null}
              </Button>
            ) : null}
            {canManage && isPublished ? <ReopenButton scheduleId={schedule.id} /> : null}
            {canManage && isDraft ? (
              <PublishDialog
                scheduleId={schedule.id}
                hardCount={hardCount}
                softCount={softCount}
                openShiftCount={openShiftCount}
              />
            ) : null}
            {canManage ? <GenerateDialog defaultStart={schedule.periodStart} /> : null}
          </div>
        </div>
      </div>

      {schedule.optimizationSummary ? (
        <p className="text-muted-foreground max-w-prose text-sm leading-relaxed">
          {schedule.optimizationSummary}
        </p>
      ) : null}

      {/* The grid */}
      <div className="bg-card overflow-x-auto rounded-lg border shadow-xs">
        <div
          className="grid min-w-[64rem]"
          style={{ gridTemplateColumns: `12rem repeat(${WINDOW_DAYS}, minmax(6rem, 1fr))` }}
        >
          {/* header */}
          <div className="bg-muted/40 border-border sticky left-0 z-10 border-b border-r px-3 py-2 text-xs font-medium">
            Team
          </div>
          {days.map((d) => (
            <div
              key={d}
              className="border-border text-muted-foreground border-b px-2 py-2 text-center text-xs font-medium tabular-nums"
            >
              {shortDate(d)}
            </div>
          ))}

          {/* rows */}
          {rows.map((row) => (
            <React.Fragment key={row.key}>
              <div className="bg-card border-border sticky left-0 z-10 flex items-center border-b border-r px-3 py-2 text-sm font-medium">
                {row.name}
              </div>
              {days.map((d) => {
                const cell = cellShifts(row.key, d);
                return (
                  <div
                    key={d}
                    className="border-border group/cell relative min-h-14 border-b px-1.5 py-1.5"
                  >
                    <div className="flex flex-col gap-1">
                      {cell.map((s) => (
                        <ShiftChip
                          key={s.id}
                          shift={s}
                          roleName={s.roleId ? (roleName.get(s.roleId) ?? null) : null}
                          violations={byShift.get(s.id) ?? []}
                          onClick={() => canManage && setEditing(s)}
                        />
                      ))}
                    </div>
                    {editable ? (
                      <button
                        type="button"
                        aria-label="Add shift"
                        onClick={() =>
                          setAdding({ day: d, employeeId: row.key === OPEN_ROW ? null : row.key })
                        }
                        className="text-muted-foreground hover:text-foreground absolute right-1 top-1 hidden rounded p-0.5 group-hover/cell:block"
                      >
                        <Plus className="size-3.5" />
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>

      {editing ? (
        <EditShiftDialog
          shift={editing}
          shifts={shifts}
          employees={employees}
          roleName={roleName}
          validation={validation}
          editable={editable}
          onClose={() => setEditing(null)}
        />
      ) : null}

      {showHistory ? (
        <HistoryDialog
          entries={auditTrail}
          employees={employees}
          onClose={() => setShowHistory(false)}
        />
      ) : null}

      {showSwaps ? (
        <SwapReviewDialog swaps={escalatedSwaps} onClose={() => setShowSwaps(false)} />
      ) : null}

      {showTimeOff ? (
        <TimeOffReviewDialog requests={timeOffRequests} onClose={() => setShowTimeOff(false)} />
      ) : null}

      {adding ? (
        <AddShiftDialog
          scheduleId={schedule.id}
          day={adding.day}
          employeeId={adding.employeeId}
          shifts={shifts}
          employees={employees}
          roles={roles}
          validation={validation}
          onClose={() => setAdding(null)}
        />
      ) : null}
    </div>
  );
}

/* --------------------------------- chip ------------------------------------ */

function ShiftChip({
  shift,
  roleName,
  violations,
  onClick,
}: {
  shift: CalendarShift;
  roleName: string | null;
  violations: EditViolation[];
  onClick: () => void;
}) {
  const hard = violations.some((v) => v.severity === "hard");
  const open = shift.employeeId === null;
  return (
    <button
      type="button"
      onClick={onClick}
      title={violations.map((v) => v.message).join("\n") || undefined}
      className={[
        "w-full rounded-md border px-2 py-1 text-left text-xs leading-tight transition-colors",
        hard
          ? "border-destructive/50 bg-destructive/10 text-destructive"
          : open
            ? "border-warning/50 border-dashed bg-warning/10 text-warning hover:bg-warning/15"
            : "border-primary/30 bg-primary/10 text-primary hover:bg-primary/15",
      ].join(" ")}
    >
      <span className="flex items-center gap-1 font-medium tabular-nums">
        {timeOf(shift.startsAt)}–{timeOf(shift.endsAt)}
        {shift.locked ? <Lock className="size-3" aria-label="Locked" /> : null}
        {hard ? <TriangleAlert className="size-3" aria-hidden /> : null}
      </span>
      {roleName ? <span className="block truncate opacity-80">{roleName}</span> : null}
    </button>
  );
}

/* ----------------------------- edit dialog --------------------------------- */

function EditShiftDialog({
  shift,
  shifts,
  employees,
  roleName,
  validation,
  editable,
  onClose,
}: {
  shift: CalendarShift;
  shifts: CalendarShift[];
  employees: Employee[];
  roleName: Map<string, string>;
  validation: ValidationContext | null;
  editable: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = React.useTransition();

  // A published schedule (editable=false) or a locked shift is read-only here.
  const locked = shift.locked || !editable;

  const [employeeId, setEmployeeId] = React.useState<string>(shift.employeeId ?? UNASSIGNED);
  const [startDate, setStartDate] = React.useState(dateOf(shift.startsAt));
  const [startTime, setStartTime] = React.useState(timeOf(shift.startsAt));
  const [endTime, setEndTime] = React.useState(timeOf(shift.endsAt));
  const [error, setError] = React.useState<string | null>(null);

  const employee = employeeId === UNASSIGNED ? null : employeeId;

  // Preview values → ISO (end rolls to next day when it isn't after start).
  const startsAt = isoOf(startDate, startTime);
  const endDate = endTime <= startTime ? addDays(startDate, 1) : startDate;
  const endsAt = isoOf(endDate, endTime);

  // Live validation: replace this shift with the pending edit, show its violations.
  const previewViolations = React.useMemo<EditViolation[]>(() => {
    if (!validation) return [];
    const next = shifts.map((s) =>
      s.id === shift.id
        ? { ...toEditShift(s), employeeId: employee, startsAt, endsAt }
        : toEditShift(s),
    );
    return validateEdits(next, validation).filter(
      (v) => v.shiftId === shift.id || (v.rule === "double_booking" && v.employeeId === employee),
    );
  }, [shifts, shift.id, employee, startsAt, endsAt, validation]);
  const hardPreview = previewViolations.filter((v) => v.severity === "hard");

  function run(fn: () => Promise<{ ok: boolean; message?: string }>, successMsg: string) {
    setError(null);
    start(async () => {
      const res = await fn();
      if (!res.ok) {
        setError(res.message ?? "Something went wrong.");
        return;
      }
      toast.add({ title: "Schedule", description: successMsg });
      router.refresh();
      onClose();
    });
  }

  const dirtyTimes = startsAt !== shift.startsAt || endsAt !== shift.endsAt;
  const dirtyEmployee = employee !== shift.employeeId;

  async function save() {
    if (locked) return { ok: false, message: "Shift can't be edited." } as const;
    // Persist whichever parts changed.
    if (dirtyTimes) {
      const r = await updateShiftTimes({
        shiftId: shift.id,
        startsAt,
        endsAt,
        breakMinutes: shift.breakMinutes,
      });
      if (!r.ok) return r;
    }
    if (dirtyEmployee) {
      const r = await assignShift({ shiftId: shift.id, employeeId: employee });
      if (!r.ok) return r;
    }
    return { ok: true } as const;
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit shift</DialogTitle>
          <DialogDescription>
            {shift.roleId ? (roleName.get(shift.roleId) ?? "Shift") : "Shift"} ·{" "}
            <span className="tabular-nums">{shortDate(dateOf(shift.startsAt))}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Assigned to</Label>
            <Select
              value={employeeId}
              onValueChange={(v) => setEmployeeId(v ?? UNASSIGNED)}
              disabled={locked}
            >
              <SelectTrigger>
                <SelectValue placeholder="Open (unassigned)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UNASSIGNED}>Open (unassigned)</SelectItem>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <label className="space-y-1.5">
              <span className="text-muted-foreground text-xs font-medium">Date</span>
              <Input
                type="date"
                value={startDate}
                disabled={locked}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-muted-foreground text-xs font-medium">From</span>
              <Input
                type="time"
                value={startTime}
                disabled={locked}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-muted-foreground text-xs font-medium">To</span>
              <Input
                type="time"
                value={endTime}
                disabled={locked}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </label>
          </div>

          <ViolationList violations={previewViolations} />
          {error ? <FormMessage>{error}</FormMessage> : null}
          {!editable ? (
            <p className="text-muted-foreground text-sm">
              This schedule is published. Reopen it for edits to make changes.
            </p>
          ) : shift.locked ? (
            <p className="text-muted-foreground text-sm">
              This shift is locked. Unlock it to make changes.
            </p>
          ) : null}
        </div>

        <DialogFooter>
          {editable ? (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  run(
                    () => toggleShiftLock({ shiftId: shift.id, locked: !shift.locked }),
                    shift.locked ? "Shift unlocked." : "Shift locked.",
                  )
                }
                disabled={pending}
              >
                {shift.locked ? <LockOpen className="size-4" /> : <Lock className="size-4" />}
                {shift.locked ? "Unlock" : "Lock"}
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={() => run(() => deleteShift({ shiftId: shift.id }), "Shift deleted.")}
                disabled={pending || shift.locked}
              >
                Delete
              </Button>
              <Button
                type="button"
                onClick={() => run(save, "Shift updated.")}
                disabled={
                  pending ||
                  shift.locked ||
                  hardPreview.length > 0 ||
                  (!dirtyTimes && !dirtyEmployee)
                }
              >
                {pending ? "Saving…" : "Save"}
              </Button>
            </>
          ) : (
            <>
              {shift.employeeId === null && shift.status === "open" ? (
                <FindReplacementButton shiftId={shift.id} />
              ) : null}
              <Button type="button" variant="outline" onClick={onClose}>
                Close
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Broadcast an open (uncovered) shift to eligible staff — first-accept-wins (Day 55). */
function FindReplacementButton({ shiftId }: { shiftId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = React.useTransition();
  return (
    <Button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await findReplacement({ shiftId });
          toast.add({
            title: "Replacement",
            description: res.ok
              ? "Sent to eligible employees. First to accept gets it."
              : (res.message ?? "Couldn't start the search."),
          });
          if (res.ok) router.refresh();
        })
      }
    >
      {pending ? "Sending…" : "Find replacement"}
    </Button>
  );
}

/* ------------------------------ add dialog --------------------------------- */

function AddShiftDialog({
  scheduleId,
  day,
  employeeId: initialEmployee,
  shifts,
  employees,
  roles,
  validation,
  onClose,
}: {
  scheduleId: string;
  day: string;
  employeeId: string | null;
  shifts: CalendarShift[];
  employees: Employee[];
  roles: RoleCertification[];
  validation: ValidationContext | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = React.useTransition();

  const [employeeId, setEmployeeId] = React.useState<string>(initialEmployee ?? UNASSIGNED);
  const [roleId, setRoleId] = React.useState<string>(ANY_ROLE);
  const [startTime, setStartTime] = React.useState("09:00");
  const [endTime, setEndTime] = React.useState("17:00");
  const [error, setError] = React.useState<string | null>(null);

  const employee = employeeId === UNASSIGNED ? null : employeeId;
  const role = roleId === ANY_ROLE ? null : roleId;

  const startsAt = isoOf(day, startTime);
  const endDate = endTime <= startTime ? addDays(day, 1) : day;
  const endsAt = isoOf(endDate, endTime);

  const previewViolations = React.useMemo<EditViolation[]>(() => {
    if (!validation) return [];
    const draft: EditShift = {
      id: "new",
      employeeId: employee,
      roleId: role,
      startsAt,
      endsAt,
      breakMinutes: 0,
    };
    return validateEdits([...shifts.map(toEditShift), draft], validation).filter(
      (v) => v.shiftId === "new" || (v.rule === "double_booking" && v.employeeId === employee),
    );
  }, [shifts, employee, role, startsAt, endsAt, validation]);
  const hardPreview = previewViolations.filter((v) => v.severity === "hard");

  function add() {
    setError(null);
    start(async () => {
      const res = await addShift({
        scheduleId,
        startsAt,
        endsAt,
        roleId: role,
        employeeId: employee,
      });
      if (!res.ok) {
        setError(res.message ?? "Something went wrong.");
        return;
      }
      toast.add({ title: "Schedule", description: "Shift added." });
      router.refresh();
      onClose();
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add shift</DialogTitle>
          <DialogDescription className="tabular-nums">{shortDate(day)}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Assigned to</Label>
            <Select value={employeeId} onValueChange={(v) => setEmployeeId(v ?? UNASSIGNED)}>
              <SelectTrigger>
                <SelectValue placeholder="Open (unassigned)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UNASSIGNED}>Open (unassigned)</SelectItem>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {roles.length > 0 ? (
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={roleId} onValueChange={(v) => setRoleId(v ?? ANY_ROLE)}>
                <SelectTrigger>
                  <SelectValue placeholder="Any role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY_ROLE}>Any role</SelectItem>
                  {roles.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1.5">
              <span className="text-muted-foreground text-xs font-medium">From</span>
              <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </label>
            <label className="space-y-1.5">
              <span className="text-muted-foreground text-xs font-medium">To</span>
              <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </label>
          </div>

          <ViolationList violations={previewViolations} />
          {error ? <FormMessage>{error}</FormMessage> : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="button" onClick={add} disabled={pending || hardPreview.length > 0}>
            {pending ? "Adding…" : "Add shift"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ----------------------------- shared bits --------------------------------- */

function ViolationList({ violations }: { violations: EditViolation[] }) {
  if (violations.length === 0) return null;
  return (
    <ul className="space-y-1.5">
      {violations.map((v, i) => (
        <li
          key={i}
          className={[
            "flex items-start gap-2 rounded-md border px-2.5 py-1.5 text-xs",
            v.severity === "hard"
              ? "border-destructive/40 bg-destructive/10 text-destructive"
              : "border-warning/40 bg-warning/10 text-warning",
          ].join(" ")}
        >
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>{v.message}</span>
        </li>
      ))}
    </ul>
  );
}

function EmptyState({ canManage }: { canManage: boolean }) {
  return (
    <div className="bg-card flex flex-col items-center gap-3 rounded-lg border border-dashed px-6 py-16 text-center">
      <CalendarRange className="text-muted-foreground size-7" />
      <p className="font-medium">No schedule yet</p>
      <p className="text-muted-foreground max-w-sm text-sm">
        {canManage
          ? "Generate a draft schedule, then review and adjust it here. Edits are checked against your rules as you make them."
          : "Your manager hasn't generated a schedule yet. Check back soon."}
      </p>
      {canManage ? <GenerateDialog defaultStart={todayUtc()} primary /> : null}
    </div>
  );
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

/* ------------------------------ publish / reopen --------------------------- */

function ReopenButton({ scheduleId }: { scheduleId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = React.useTransition();
  return (
    <Button
      variant="default"
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await reopenSchedule({ scheduleId });
          toast.add({
            title: "Schedule",
            description: res.ok ? "Reopened for edits." : (res.message ?? "Couldn't reopen."),
          });
          if (res.ok) router.refresh();
        })
      }
    >
      <LockOpen className="size-4" /> {pending ? "Reopening…" : "Reopen for edits"}
    </Button>
  );
}

function PublishDialog({
  scheduleId,
  hardCount,
  softCount,
  openShiftCount,
}: {
  scheduleId: string;
  hardCount: number;
  softCount: number;
  openShiftCount: number;
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = React.useState(false);
  const [pending, start] = React.useTransition();
  const [ack, setAck] = React.useState(false);
  const [note, setNote] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const needsAck = openShiftCount > 0 || softCount > 0;
  const blockedHard = hardCount > 0;
  const canPublish = !blockedHard && (!needsAck || ack);

  function publish() {
    setError(null);
    start(async () => {
      const res = await publishSchedule({ scheduleId, override: needsAck, note });
      if (!res.ok) {
        setError(res.message ?? "Couldn't publish.");
        return;
      }
      toast.add({ title: "Schedule", description: "Schedule published." });
      router.refresh();
      setOpen(false);
    });
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <CheckCircle2 className="size-4" /> Publish
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Publish schedule</DialogTitle>
            <DialogDescription>
              Publishing locks in this schedule as the approved version. (Employees are notified in
              a later step.)
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {blockedHard ? (
              <div className="border-destructive/40 bg-destructive/10 text-destructive flex items-start gap-2 rounded-md border px-3 py-2 text-sm">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span>
                  Fix {hardCount} conflict{hardCount > 1 ? "s" : ""} before publishing. Conflicts
                  are flagged in red on the calendar.
                </span>
              </div>
            ) : needsAck ? (
              <label className="border-warning/40 bg-warning/10 flex items-start gap-2 rounded-md border px-3 py-2 text-sm">
                <Checkbox
                  checked={ack}
                  onCheckedChange={(v) => setAck(v === true)}
                  className="mt-0.5"
                />
                <span className="text-foreground">
                  Publish with{" "}
                  {[
                    openShiftCount > 0
                      ? `${openShiftCount} open shift${openShiftCount > 1 ? "s" : ""}`
                      : null,
                    softCount > 0 ? `${softCount} warning${softCount > 1 ? "s" : ""}` : null,
                  ]
                    .filter(Boolean)
                    .join(" and ")}
                  . I have reviewed and want to publish anyway.
                </span>
              </label>
            ) : (
              <div className="border-success/40 bg-success/10 text-success flex items-start gap-2 rounded-md border px-3 py-2 text-sm">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span>Fully covered with no conflicts. Ready to publish.</span>
              </div>
            )}

            <label className="space-y-1.5">
              <span className="text-muted-foreground text-xs font-medium">Note (optional)</span>
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Approved for the long weekend"
                maxLength={300}
              />
            </label>
            {error ? <FormMessage>{error}</FormMessage> : null}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={publish} disabled={pending || !canPublish}>
              {pending ? "Publishing…" : "Publish"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* -------------------------------- history ---------------------------------- */

const ACTION_LABEL: Record<string, string> = {
  "schedule.created": "Draft generated",
  "schedule.published": "Published",
  "schedule.reopened": "Reopened for edits",
  "candidate_panel.judged": "Candidates judged",
  "shift.assigned": "Shift reassigned",
  "shift.retimed": "Shift retimed",
  "shift.added": "Shift added",
  "shift.deleted": "Shift removed",
  "shift.locked": "Shift locked",
  "shift.unlocked": "Shift unlocked",
  "replacement.requested": "Replacement requested",
  "shift_swap.requested": "Swap requested",
  "shift_swap.escalated": "Swap escalated",
  "shift_swap.approved": "Swap approved",
  "shift_swap.applied": "Swap applied",
  "shift_swap.declined": "Swap declined",
  "shift_swap.denied": "Swap denied",
};

function HistoryDialog({
  entries,
  employees,
  onClose,
}: {
  entries: AuditEntry[];
  employees: Employee[];
  onClose: () => void;
}) {
  const empName = React.useMemo(() => new Map(employees.map((e) => [e.id, e.name])), [employees]);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change history</DialogTitle>
          <DialogDescription>Every change to this schedule, newest first.</DialogDescription>
        </DialogHeader>
        {entries.length === 0 ? (
          <p className="text-muted-foreground text-sm">No changes recorded yet.</p>
        ) : (
          <ul className="max-h-[24rem] space-y-2 overflow-y-auto">
            {entries.map((e) => (
              <li key={e.id} className="flex items-start gap-3 text-sm">
                <Clock className="text-muted-foreground mt-0.5 size-4 shrink-0" aria-hidden />
                <div className="min-w-0">
                  <p className="font-medium">{ACTION_LABEL[e.action] ?? e.action}</p>
                  <p className="text-muted-foreground text-xs">
                    <span className="capitalize">{e.actorType}</span>
                    {typeof e.detail.employee_id === "string" && empName.get(e.detail.employee_id)
                      ? ` · ${empName.get(e.detail.employee_id)}`
                      : ""}
                    {typeof e.detail.version === "string" ? ` · ${e.detail.version}` : ""}
                    {` · ${e.createdAt.slice(0, 16).replace("T", " ")}`}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SwapReviewDialog({ swaps, onClose }: { swaps: EscalatedSwap[]; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const [, start] = React.useTransition();

  function act(requestId: string, approve: boolean) {
    setPendingId(requestId);
    start(async () => {
      const res = approve ? await approveSwap({ requestId }) : await denySwap({ requestId });
      setPendingId(null);
      toast.add({
        title: "Swap",
        description: res.ok
          ? approve
            ? "Swap approved."
            : "Swap denied."
          : (res.message ?? "Couldn't update."),
      });
      if (res.ok) router.refresh();
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Shift swaps to review</DialogTitle>
          <DialogDescription>
            Swaps an agent couldn&apos;t auto-approve. Approve to apply, or deny.
          </DialogDescription>
        </DialogHeader>
        {swaps.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nothing to review.</p>
        ) : (
          <ul className="max-h-[24rem] space-y-3 overflow-y-auto">
            {swaps.map((s) => {
              const busy = pendingId === s.requestId;
              return (
                <li key={s.requestId} className="border-border rounded-lg border p-3">
                  <p className="text-sm">
                    <strong>{s.claimantName}</strong> would take <strong>{s.requesterName}</strong>
                    &apos;s <span className="tabular-nums">{s.shiftLabel}</span> shift
                    {s.tradeForLabel ? (
                      <>
                        {" "}
                        in exchange for their{" "}
                        <span className="tabular-nums">{s.tradeForLabel}</span> shift
                      </>
                    ) : null}
                    .
                  </p>
                  <div className="mt-2 flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => act(s.requestId, true)}
                      disabled={busy}
                    >
                      {busy ? "…" : "Approve"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => act(s.requestId, false)}
                      disabled={busy}
                    >
                      Deny
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const TIME_OFF_BAND_LABEL: Record<string, string> = {
  low: "Low impact",
  medium: "Medium impact",
  high: "High impact",
};

/** "Jun 15 – Jun 18" (or "Jun 15" for a single day) from YYYY-MM-DD. */
function timeOffRangeLabel(startDate: string, endDate: string): string {
  const fmt = (d: string) =>
    new Date(`${d}T00:00:00Z`).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
  return startDate === endDate ? fmt(startDate) : `${fmt(startDate)} – ${fmt(endDate)}`;
}

function TimeOffReviewDialog({
  requests,
  onClose,
}: {
  requests: PendingTimeOff[];
  onClose: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const [, start] = React.useTransition();

  function act(requestId: string, action: "approve" | "deny" | "reverse") {
    setPendingId(requestId);
    start(async () => {
      const res =
        action === "approve"
          ? await approveTimeOff({ requestId })
          : action === "deny"
            ? await denyTimeOff({ requestId })
            : await reverseTimeOff({ requestId });
      setPendingId(null);
      const done = action === "approve" ? "approved" : action === "reverse" ? "reversed" : "denied";
      toast.add({
        title: "Time off",
        description: res.ok ? `Request ${done}.` : (res.message ?? "Couldn't update."),
      });
      if (res.ok) router.refresh();
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Time-off requests</DialogTitle>
          <DialogDescription>
            The agent assessed staffing impact. Low-impact requests are auto-approved — you can
            reverse one if you need the cover.
          </DialogDescription>
        </DialogHeader>
        {requests.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nothing to review.</p>
        ) : (
          <ul className="max-h-[24rem] space-y-3 overflow-y-auto">
            {requests.map((r) => {
              const busy = pendingId === r.id;
              const approved = r.status === "approved";
              return (
                <li key={r.id} className="border-border rounded-lg border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm">
                      <strong>{r.employeeName}</strong>{" "}
                      <span className="tabular-nums">
                        {timeOffRangeLabel(r.startDate, r.endDate)}
                      </span>
                      {approved ? (
                        <span className="text-emerald-600 dark:text-emerald-400">
                          {" "}
                          · approved{r.autoDecided ? " (auto)" : ""}
                        </span>
                      ) : null}
                    </p>
                    {r.impactBand ? (
                      <Badge
                        variant={r.impactBand === "high" ? "warning" : "secondary"}
                        className="shrink-0"
                      >
                        {TIME_OFF_BAND_LABEL[r.impactBand] ?? r.impactBand}
                      </Badge>
                    ) : null}
                  </div>
                  {r.reason ? (
                    <p className="text-muted-foreground mt-1 text-xs">{r.reason}</p>
                  ) : null}
                  {r.recommendation ? (
                    <p className="text-muted-foreground mt-1 text-xs italic">{r.recommendation}</p>
                  ) : null}
                  <div className="mt-2 flex gap-2">
                    {approved ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => act(r.id, "reverse")}
                        disabled={busy}
                      >
                        {busy ? "…" : "Reverse"}
                      </Button>
                    ) : (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => act(r.id, "approve")}
                          disabled={busy}
                        >
                          {busy ? "…" : "Approve"}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => act(r.id, "deny")}
                          disabled={busy}
                        >
                          Deny
                        </Button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function GenerateDialog({ defaultStart, primary }: { defaultStart: string; primary?: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = React.useState(false);
  const [pending, start] = React.useTransition();
  const [periodStart, setPeriodStart] = React.useState(defaultStart);
  const [periodEnd, setPeriodEnd] = React.useState(addDays(defaultStart, WINDOW_DAYS - 1));
  const [error, setError] = React.useState<string | null>(null);

  function generate() {
    setError(null);
    start(async () => {
      const res = await generateDraftSchedule({ periodStart, periodEnd });
      if (!res.ok) {
        setError(res.message ?? "Couldn't build the schedule.");
        return;
      }
      toast.add({ title: "Schedule", description: "Draft generated." });
      router.refresh();
      setOpen(false);
    });
  }

  return (
    <>
      <Button
        variant={primary ? "default" : "outline"}
        size={primary ? "default" : "sm"}
        onClick={() => setOpen(true)}
      >
        <CalendarRange className="size-4" /> Generate draft
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate a draft schedule</DialogTitle>
            <DialogDescription>
              The assistant builds a draft for this period from availability, staffing needs, and
              your labor rules. You can adjust it afterward.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1.5">
              <span className="text-muted-foreground text-xs font-medium">Start</span>
              <Input
                type="date"
                value={periodStart}
                onChange={(e) => {
                  setPeriodStart(e.target.value);
                  if (e.target.value > periodEnd)
                    setPeriodEnd(addDays(e.target.value, WINDOW_DAYS - 1));
                }}
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-muted-foreground text-xs font-medium">End</span>
              <Input
                type="date"
                value={periodEnd}
                min={periodStart}
                onChange={(e) => setPeriodEnd(e.target.value)}
              />
            </label>
          </div>
          {error ? <FormMessage>{error}</FormMessage> : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={generate} disabled={pending || periodEnd < periodStart}>
              {pending ? "Generating…" : "Generate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
