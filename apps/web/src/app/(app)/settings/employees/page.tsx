import { redirect } from "next/navigation";

/**
 * Day 52 — the roster moved into the scheduling product. Keep the old settings URL
 * working by redirecting to the new home.
 */
export default function EmployeesSettingsRedirect() {
  redirect("/scheduling/employees");
}
