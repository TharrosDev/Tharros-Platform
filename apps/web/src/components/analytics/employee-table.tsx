"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp } from "lucide-react";

import type { EmployeeAnalytics } from "@/lib/analytics/metrics";
import { formatPercent, reliabilityBand } from "@/lib/analytics/metrics";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type SortKey = "name" | "assignedShifts" | "assignedHours" | "reliability" | "sickCalls" | "acceptanceRate";
type SortDir = "asc" | "desc";

const COLUMNS: { key: SortKey; label: string; numeric: boolean }[] = [
  { key: "name", label: "Employee", numeric: false },
  { key: "assignedShifts", label: "Shifts", numeric: true },
  { key: "assignedHours", label: "Hours", numeric: true },
  { key: "reliability", label: "Reliability", numeric: true },
  { key: "sickCalls", label: "Sick calls", numeric: true },
  { key: "acceptanceRate", label: "Acceptance", numeric: true },
];

const BAND_DOT: Record<string, string> = {
  good: "bg-success",
  watch: "bg-warning",
  poor: "bg-destructive",
};

/**
 * Per-employee analytics table with client-side sorting (the rows are already
 * loaded; orgs are small). Default order mirrors the server's. Nulls sort
 * last in either direction so "worst reliability" surfaces real numbers.
 */
export function EmployeeAnalyticsTable({ employees }: { employees: EmployeeAnalytics[] }) {
  const [sortKey, setSortKey] = React.useState<SortKey | null>(null);
  const [dir, setDir] = React.useState<SortDir>("desc");

  function toggle(key: SortKey) {
    if (sortKey !== key) {
      setSortKey(key);
      setDir(key === "name" ? "asc" : "desc");
    } else {
      setDir((d) => (d === "asc" ? "desc" : "asc"));
    }
  }

  const rows = React.useMemo(() => {
    if (!sortKey) return employees;
    const sorted = [...employees].sort((a, b) => {
      if (sortKey === "name") return a.name.localeCompare(b.name);
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av === null && bv === null) return 0;
      if (av === null) return 1; // nulls last regardless of direction
      if (bv === null) return -1;
      return av - bv;
    });
    if (dir === "desc") sorted.reverse();
    return sorted;
  }, [employees, sortKey, dir]);

  return (
    <div className="bg-card shadow-card overflow-hidden rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            {COLUMNS.map((col) => {
              const active = sortKey === col.key;
              return (
                <TableHead
                  key={col.key}
                  aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : undefined}
                  className={cn(col.numeric && "text-right")}
                >
                  <button
                    type="button"
                    onClick={() => toggle(col.key)}
                    className={cn(
                      "focus-visible:ring-ring/40 inline-flex items-center gap-1 rounded-sm outline-none transition-colors focus-visible:ring-[3px]",
                      active ? "text-foreground" : "hover:text-foreground",
                    )}
                  >
                    {col.label}
                    {active ? (
                      dir === "asc" ? (
                        <ArrowUp className="size-3" aria-hidden />
                      ) : (
                        <ArrowDown className="size-3" aria-hidden />
                      )
                    ) : null}
                  </button>
                </TableHead>
              );
            })}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((e) => {
            const band = reliabilityBand(e.reliability);
            return (
              <TableRow key={e.employeeId}>
                <TableCell className="font-medium">
                  <Link href={`/scheduling/employees/${e.employeeId}`} className="hover:underline">
                    {e.name}
                  </Link>
                </TableCell>
                <TableCell className="text-right tabular-nums">{e.assignedShifts}</TableCell>
                <TableCell className="text-right tabular-nums">{e.assignedHours}</TableCell>
                <TableCell className="text-right">
                  {band === "none" ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 tabular-nums">
                      <span
                        aria-hidden
                        className={cn("size-1.5 rounded-full", BAND_DOT[band])}
                      />
                      {formatPercent(e.reliability)}
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">{e.sickCalls}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatPercent(e.acceptanceRate)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
