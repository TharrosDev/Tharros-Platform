import "server-only";

import { getStripe } from "@/lib/billing/client";
import { logger } from "@/lib/observability/logger";

/**
 * Day 20 — read-side billing data for the settings page. Inline recent invoices;
 * the Customer Portal covers the full history.
 */

export type InvoiceSummary = {
  id: string;
  number: string | null;
  created: string; // ISO
  total: number; // cents
  currency: string;
  status: string | null;
  hostedUrl: string | null;
  pdfUrl: string | null;
};

/** The org's most recent invoices, newest first. `[]` on error or none. */
export async function getRecentInvoices(
  customerId: string,
  limit = 5,
): Promise<InvoiceSummary[]> {
  try {
    const res = await getStripe().invoices.list({ customer: customerId, limit });
    return res.data.map((inv) => ({
      id: inv.id ?? "",
      number: inv.number,
      created: new Date(inv.created * 1000).toISOString(),
      total: inv.total,
      currency: inv.currency,
      status: inv.status,
      hostedUrl: inv.hosted_invoice_url ?? null,
      pdfUrl: inv.invoice_pdf ?? null,
    }));
  } catch (err) {
    logger.error("billing.invoices_list_failed", {
      customer_id: customerId,
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}
