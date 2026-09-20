"use client";

import { useState, useTransition } from "react";
import { CalendarPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { MyTimeOff } from "@/lib/portal/schedule";
import { requestTimeOff } from "@/lib/portal/time-off-actions";

/**
 * Day 57 — the employee's time-off panel on the portal schedule. Lists their recent
 * requests with status, and opens a small dialog to request a new date range. The
 * agent evaluates staffing impact server-side; a low-impact request comes back
 * already approved, otherwise it's sent to a manager. Submitting revalidates the
 * schedule so the new request appears in the list.
 */

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  approved: "Approved",
  denied: "Denied",
};

const STATUS_CLASS: Record<string, string> = {
  pending: "text-muted-foreground",
  approved: "text-success",
  denied: "text-destructive",
};

/** "Jun 15 – Jun 18" (or "Jun 15" for a single day) from YYYY-MM-DD. */
function rangeText(startDate: string, endDate: string): string {
  const fmt = (d: string) =>
    new Date(`${d}T00:00:00Z`).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
  return startDate === endDate ? fmt(startDate) : `${fmt(startDate)} – ${fmt(endDate)}`;
}

export function TimeOffSection({ requests }: { requests: MyTimeOff[] }) {
  const toast = useToast();
  const today = new Date().toISOString().slice(0, 10);

  const [open, setOpen] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    if (!startDate || !endDate) {
      setError("Pick a start and end date.");
      return;
    }
    if (endDate < startDate) {
      setError("The end date can't be before the start date.");
      return;
    }
    startTransition(async () => {
      const res = await requestTimeOff(startDate, endDate, reason.trim() || undefined);
      if (res.ok) {
        setOpen(false);
        setStartDate("");
        setEndDate("");
        setReason("");
        toast.add({ title: "Request sent", description: res.message });
      } else {
        setError(res.message);
      }
    });
  }

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="type-h2">Time off</h2>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-muted-foreground hover:text-foreground inline-flex shrink-0 items-center gap-1 text-xs"
        >
          <CalendarPlus className="size-4" /> Request time off
        </button>
      </div>

      {requests.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {requests.map((r) => (
            <li
              key={r.id}
              className="border-border bg-card flex items-center justify-between border px-3 py-2"
            >
              <div className="min-w-0">
                <p className="type-small font-medium">{rangeText(r.startDate, r.endDate)}</p>
                {r.reason ? (
                  <p className="text-muted-foreground truncate text-xs">{r.reason}</p>
                ) : null}
              </div>
              <span
                className={`type-meta shrink-0 font-medium ${STATUS_CLASS[r.status] ?? "text-muted-foreground"}`}
              >
                {STATUS_LABEL[r.status] ?? r.status}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground type-small">No time-off requests yet.</p>
      )}

      <Dialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Request time off</DialogTitle>
            <DialogDescription>
              We&apos;ll check the schedule and let your manager know.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3">
            <div className="flex gap-3">
              <div className="flex flex-1 flex-col gap-1.5">
                <label htmlFor="time-off-start" className="type-small font-medium">
                  From
                </label>
                <Input
                  id="time-off-start"
                  type="date"
                  min={today}
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    if (endDate && e.target.value > endDate) setEndDate(e.target.value);
                  }}
                  disabled={pending}
                />
              </div>
              <div className="flex flex-1 flex-col gap-1.5">
                <label htmlFor="time-off-end" className="type-small font-medium">
                  To
                </label>
                <Input
                  id="time-off-end"
                  type="date"
                  min={startDate || today}
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  disabled={pending}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="time-off-reason" className="type-small font-medium">
                Reason (optional)
              </label>
              <Textarea
                id="time-off-reason"
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Family trip"
                disabled={pending}
              />
            </div>
          </div>

          {error ? <p className="text-destructive type-small">{error}</p> : null}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Never mind
            </Button>
            <Button type="button" onClick={submit} disabled={pending}>
              {pending ? "Sending…" : "Send request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
