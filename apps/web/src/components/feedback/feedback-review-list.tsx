"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, m } from "motion/react";
import { Bug, Check, Lightbulb, Star, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { approveUsageBonus, resolveSubmission } from "@/lib/feedback/admin-actions";

export type ReviewSubmission = {
  id: string;
  org_id: string;
  user_id: string;
  kind: "suggestion" | "bug" | "wish";
  severity: "minor" | "major";
  user_text: string;
  ai_summary: string;
  recommended_reward: "none" | "usage_bonus";
  reward_status: "pending" | "approved" | "denied";
  reward_note: string | null;
  status: "new" | "reviewed";
  created_at: string;
  orgName: string;
  submitterName: string | null;
};

const KIND_ICON = { suggestion: Lightbulb, bug: Bug, wish: Star } as const;
const DEFAULT_BONUS = { minor: 100, major: 500 } as const;

/** Pending submissions first, each with approve-bonus / close controls. */
export function FeedbackReviewList({ submissions }: { submissions: ReviewSubmission[] }) {
  const pending = submissions.filter((s) => s.status === "new");
  const reviewed = submissions.filter((s) => s.status !== "new");

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="type-h2">
          Waiting on you{" "}
          <span className="text-muted-foreground text-base font-normal">({pending.length})</span>
        </h2>
        {pending.length === 0 ? (
          <p className="text-muted-foreground type-body">Nothing new. Check back later.</p>
        ) : (
          <div className="space-y-3">
            <AnimatePresence initial={false}>
              {pending.map((s) => (
                <ReviewCard key={s.id} submission={s} />
              ))}
            </AnimatePresence>
          </div>
        )}
      </section>

      {reviewed.length > 0 ? (
        <section className="space-y-3">
          <h2 className="type-h2">
            Recently reviewed{" "}
            <span className="text-muted-foreground text-base font-normal">({reviewed.length})</span>
          </h2>
          <ul className="rounded-xl bg-card divide-border/60 overflow-hidden border divide-y">
            {reviewed.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-2 px-4 py-2.5 text-sm">
                <span className="font-medium">{s.orgName}</span>
                <Badge variant="secondary">{s.kind}</Badge>
                {s.reward_status === "approved" ? (
                  <Badge variant="success">{s.reward_note ?? "Rewarded"}</Badge>
                ) : s.reward_status === "denied" ? (
                  <Badge variant="outline">No reward</Badge>
                ) : null}
                <span className="text-muted-foreground min-w-0 flex-1 truncate">
                  {s.ai_summary}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function ReviewCard({ submission: s }: { submission: ReviewSubmission }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = React.useTransition();
  const [bonus, setBonus] = React.useState(String(DEFAULT_BONUS[s.severity]));
  const Icon = KIND_ICON[s.kind];

  function run(fn: () => Promise<{ ok: true } | { ok: false; message: string }>, done: string) {
    startTransition(async () => {
      const res = await fn();
      if (res.ok) {
        toast.add({ title: done });
        router.refresh();
      } else {
        toast.add({ title: "That didn't go through", description: res.message });
      }
    });
  }

  return (
    <m.div
      layout
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className="rounded-xl bg-card space-y-3 border p-4"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="bg-primary-soft text-primary-soft-foreground flex size-7 items-center justify-center">
          <Icon className="size-4" aria-hidden />
        </span>
        <span className="font-medium">{s.orgName}</span>
        {s.submitterName ? (
          <span className="text-muted-foreground text-sm">· {s.submitterName}</span>
        ) : null}
        <Badge variant="secondary">{s.kind}</Badge>
        <Badge variant={s.severity === "major" ? "warning" : "outline"}>{s.severity}</Badge>
        {s.recommended_reward === "usage_bonus" ? (
          <Badge variant="info">AI suggests a bonus</Badge>
        ) : null}
        <span className="text-muted-foreground ml-auto text-xs">
          {new Date(s.created_at).toLocaleDateString("en-CA")}
        </span>
      </div>

      <div className="bg-surface-2 p-3">
        <p className="type-meta text-muted-foreground">They wrote</p>
        <p className="type-small mt-1 whitespace-pre-wrap">{s.user_text}</p>
      </div>
      <div className="bg-primary-soft/30 p-3">
        <p className="type-meta text-primary-soft-foreground">Agent summary (internal)</p>
        <p className="type-small mt-1">{s.ai_summary}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5">
          <Input
            inputMode="numeric"
            value={bonus}
            onChange={(e) => setBonus(e.target.value)}
            aria-label="Bonus queries"
            className={cn("h-8 w-20 text-center text-sm")}
          />
          <span className="text-muted-foreground text-xs">queries</span>
        </div>
        <Button
          size="sm"
          disabled={pending}
          onClick={() =>
            run(
              () => approveUsageBonus({ submissionId: s.id, queries: Number(bonus) }),
              "Bonus approved",
            )
          }
        >
          <Check className="size-3.5" /> Approve bonus
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() =>
            run(
              () => resolveSubmission({ submissionId: s.id, decision: "denied" }),
              "Closed without a reward",
            )
          }
        >
          <X className="size-3.5" /> No reward
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() =>
            run(
              () => resolveSubmission({ submissionId: s.id, decision: "reviewed" }),
              "Marked reviewed",
            )
          }
        >
          Mark reviewed
        </Button>
      </div>
    </m.div>
  );
}
