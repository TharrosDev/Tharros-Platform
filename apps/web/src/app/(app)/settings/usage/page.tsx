import type { Metadata } from "next";

import { getOrgContext } from "@/lib/org/queries";
import { getSubscription } from "@/lib/billing/entitlements";
import { queryCapFor } from "@/lib/billing/plans";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormMessage } from "@/components/auth/auth-card";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Usage" };

/** Shape of the per-model entry in the ai_usage_summary `by_model` jsonb. */
type ModelUsage = {
  queryCount: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
};

type UsageSummary = {
  query_count: number;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_creation_tokens: number;
  by_model: Record<string, ModelUsage>;
};

const numberFmt = new Intl.NumberFormat("en-CA");

export default async function UsagePage() {
  const { activeOrg } = await getOrgContext();

  if (!activeOrg) {
    return (
      <>
        <PageHeader title="Usage" description="Your AI usage this month." />
        <p className="text-muted-foreground type-body">Select or create an organization first.</p>
      </>
    );
  }

  // Owner-gated, matching the billing + org-profile pattern.
  if (activeOrg.role !== "owner") {
    return (
      <>
        <PageHeader title="Usage" description="Your AI usage this month." />
        <FormMessage tone="error">Only the organization owner can view usage.</FormMessage>
      </>
    );
  }

  const supabase = await createClient();
  const [sub, summaryRes] = await Promise.all([
    getSubscription(),
    supabase.rpc("ai_usage_summary", { p_org: activeOrg.id }),
  ]);

  const summary = ((summaryRes.data as UsageSummary[] | null)?.[0] ?? {
    query_count: 0,
    input_tokens: 0,
    output_tokens: 0,
    cache_read_tokens: 0,
    cache_creation_tokens: 0,
    by_model: {},
  }) satisfies UsageSummary;

  const cap = sub?.tier ? queryCapFor(sub.tier) : 0;
  const used = summary.query_count;
  const pct = cap > 0 ? Math.min(100, Math.round((used / cap) * 100)) : 0;

  const totalTokens =
    summary.input_tokens +
    summary.output_tokens +
    summary.cache_read_tokens +
    summary.cache_creation_tokens;
  const avgTokensPerQuery = used > 0 ? Math.round(totalTokens / used) : 0;
  const cachedShare =
    totalTokens > 0 ? Math.round((summary.cache_read_tokens / totalTokens) * 100) : 0;

  return (
    <>
      <PageHeader title="Usage" description="AI assistant usage for the current calendar month." />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Queries this month</CardTitle>
            <CardDescription>
              {sub?.tier
                ? `Your ${sub.tier} plan includes ${numberFmt.format(cap)} AI queries per month.`
                : "No active plan. Choose one on the Billing page to start using the assistant."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-baseline justify-between">
              <span className="type-h1">{numberFmt.format(used)}</span>
              <span className="text-muted-foreground text-sm">of {numberFmt.format(cap)}</span>
            </div>
            <div className="bg-accent h-2 w-full overflow-hidden rounded-full" aria-hidden>
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  pct >= 100 ? "bg-destructive" : pct >= 80 ? "bg-amber-500" : "bg-primary",
                )}
                style={{ width: `${pct}%` }}
              />
            </div>
            {cap > 0 && used >= cap ? (
              <FormMessage tone="error">
                You&apos;ve reached this month&apos;s limit. Upgrade your plan to keep using the
                assistant.
              </FormMessage>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Token usage</CardTitle>
            <CardDescription>Tokens the assistant processed this month.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <span className="type-h1">{numberFmt.format(totalTokens)}</span>
            <dl className="text-muted-foreground space-y-1.5 text-sm">
              <div className="flex justify-between">
                <dt>Input tokens</dt>
                <dd className="text-foreground">{numberFmt.format(summary.input_tokens)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Output tokens</dt>
                <dd className="text-foreground">{numberFmt.format(summary.output_tokens)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Cached (read) tokens</dt>
                <dd className="text-foreground">{numberFmt.format(summary.cache_read_tokens)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Cached (written) tokens</dt>
                <dd className="text-foreground">
                  {numberFmt.format(summary.cache_creation_tokens)}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Activity</CardTitle>
          <CardDescription>How the assistant is being used this month.</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="divide-border divide-y text-sm">
            <div className="flex items-center justify-between py-2.5">
              <dt className="text-foreground font-medium">Average tokens per query</dt>
              <dd className="text-muted-foreground">{numberFmt.format(avgTokensPerQuery)}</dd>
            </div>
            <div className="flex items-center justify-between py-2.5">
              <dt className="text-foreground font-medium">Cached share of tokens</dt>
              <dd className="text-muted-foreground">{cachedShare}%</dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </>
  );
}
