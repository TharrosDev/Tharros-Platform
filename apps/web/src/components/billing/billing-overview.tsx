import { ExternalLink } from "lucide-react";

import { openBillingPortal } from "@/lib/billing/actions";
import { getPlan, formatMonthly } from "@/lib/billing/plans";
import { statusBadgeVariant, statusLabel } from "@/lib/billing/status";
import type { SubscriptionSnapshot } from "@/lib/billing/entitlements";
import type { InvoiceSummary } from "@/lib/billing/queries";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat("en-CA", { dateStyle: "medium" }).format(new Date(iso));

const fmtMoney = (cents: number, currency: string) =>
  new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100);

/** The renewal/trial/cancellation line for the current period. */
function periodLine(sub: SubscriptionSnapshot): string | null {
  if (sub.cancel_at_period_end && sub.current_period_end) {
    return `Cancels on ${fmtDate(sub.current_period_end)}`;
  }
  if (sub.status === "trialing" && sub.trial_ends_at) {
    return `Free trial ends ${fmtDate(sub.trial_ends_at)}`;
  }
  if (sub.current_period_end) {
    return `Renews ${fmtDate(sub.current_period_end)}`;
  }
  return null;
}

/**
 * Day 20 — billing settings for a subscribed org: current plan + status +
 * renewal, a "Manage billing" button into the Stripe Customer Portal (owner
 * only), and recent invoices. Cancel/reactivate/update-card all live in the
 * portal.
 */
export function BillingOverview({
  subscription,
  invoices,
  isOwner,
}: {
  subscription: SubscriptionSnapshot;
  invoices: InvoiceSummary[];
  isOwner: boolean;
}) {
  const plan = subscription.tier ? getPlan(subscription.tier) : null;
  const line = periodLine(subscription);

  return (
    <div className="space-y-8">
      <Card className="visual-panel-strong overflow-hidden">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2.5">
                <CardTitle className="type-h2">{plan?.name ?? "Your plan"}</CardTitle>
                <Badge variant={statusBadgeVariant(subscription.status)}>
                  {statusLabel(subscription.status)}
                </Badge>
              </div>
              <CardDescription>
                {plan ? (
                  <>
                    <span className="num text-foreground font-medium">
                      {formatMonthly(plan.priceMonthly)}
                    </span>{" "}
                    CAD / month
                  </>
                ) : null}
                {plan && line ? " · " : null}
                {line}
              </CardDescription>
            </div>
            {isOwner ? (
              <form action={openBillingPortal}>
                <Button type="submit" variant="outline">
                  Manage billing
                  <ExternalLink className="size-4" />
                </Button>
              </form>
            ) : null}
          </div>
        </CardHeader>
        {plan ? (
          <CardContent>
            <ul className="grid gap-2 sm:grid-cols-2">
              {plan.features.map((feature) => (
                <li key={feature} className="text-muted-foreground type-small flex items-start gap-2 rounded-lg border border-border/50 bg-surface-2/45 px-3 py-2">
                  <span className="bg-primary/60 mt-2 size-1 shrink-0 rounded-full" aria-hidden />
                  {feature}
                </li>
              ))}
            </ul>
            {!isOwner ? (
              <p className="text-muted-foreground type-small mt-4">
                Only the organization owner can manage billing.
              </p>
            ) : null}
          </CardContent>
        ) : null}
      </Card>

      <section className="space-y-3">
        <h2 className="type-h2">Invoices</h2>
        {invoices.length === 0 ? (
          <p className="text-muted-foreground type-small">
            No invoices yet. They&apos;ll appear here once your first payment is
            processed.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Receipt</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell>{fmtDate(inv.created)}</TableCell>
                  <TableCell>{fmtMoney(inv.total, inv.currency)}</TableCell>
                  <TableCell className="capitalize">{inv.status ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    {inv.hostedUrl ? (
                      <a
                        href={inv.hostedUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-foreground inline-flex items-center gap-1 underline underline-offset-4"
                      >
                        View
                        <ExternalLink className="size-3.5" />
                      </a>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  );
}
