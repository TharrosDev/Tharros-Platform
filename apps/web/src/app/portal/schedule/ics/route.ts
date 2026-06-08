import { getPortalSession } from "@/lib/portal/session";
import { getPortalSchedule } from "@/lib/portal/schedule";
import { buildICS, type IcsEvent } from "@/lib/scheduling/ics";

/**
 * Day 53 — download the employee's next-two-weeks schedule as an .ics file.
 * Session-scoped (cookie token → employee/org); under /portal so anon-reachable.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getPortalSession();
  if (!session) {
    return new Response("This link isn't active.", { status: 401 });
  }

  const shifts = await getPortalSchedule(session.employeeId, session.orgId);
  const events: IcsEvent[] = shifts.map((s) => ({
    uid: `${s.id}@tharros`,
    title: s.roleName ? `${s.roleName} shift` : `${session.orgName} shift`,
    startsAt: s.startsAt,
    endsAt: s.endsAt,
    location: session.orgName,
    description: s.notes ?? undefined,
  }));

  const ics = buildICS(events, `${session.orgName} schedule`);
  return new Response(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="schedule.ics"',
      "Cache-Control": "no-store",
    },
  });
}
