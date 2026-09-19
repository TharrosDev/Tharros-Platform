import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Parse a `YYYY-MM-DD` date as a local calendar day (not UTC midnight). */
function parseDay(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Human period label for date-only ranges: "Sep 14 – 20", "Sep 28 – Oct 4",
 * "Dec 28, 2026 – Jan 3, 2027". Years appear only when the range crosses one.
 */
export function formatDateRange(start: string, end: string): string {
  const a = parseDay(start);
  const b = parseDay(end);
  const crossesYear = a.getFullYear() !== b.getFullYear();
  const day = (d: Date, withMonth: boolean, withYear: boolean) =>
    new Intl.DateTimeFormat("en-CA", {
      month: withMonth ? "short" : undefined,
      day: "numeric",
      year: withYear ? "numeric" : undefined,
    }).format(d);
  const sameMonth = !crossesYear && a.getMonth() === b.getMonth();
  return `${day(a, true, crossesYear)} – ${day(b, !sameMonth, crossesYear)}`;
}
