/**
 * Day 34 — labeled RAG eval set over the synthesized fixture corpus in
 * `./fixtures`. Pure data (no secrets), consumed by the gated harness
 * (`rag-eval.live.ts`). Ground truth is unambiguous because the fixtures state
 * concrete facts.
 *
 * - `expectedDocs`  — fixture filename(s) that contain the answer; drives
 *   retrieval recall + citation accuracy.
 * - `expectedFacts` — distinctive substrings a correct answer should contain
 *   (case-insensitive); a cheap deterministic groundedness proxy. Kept to the
 *   most stable tokens (numbers, prices) so phrasing variation doesn't fail them.
 * - `negative`      — true when the corpus does NOT cover the question; a correct
 *   answer must decline ("I don't know") and cite nothing.
 */

export type EvalQuestion = {
  id: string;
  question: string;
  expectedDocs: string[];
  expectedFacts: string[];
  negative?: boolean;
};

export const EVAL_QUESTIONS: readonly EvalQuestion[] = [
  // refund-policy.md
  {
    id: "refund-window",
    question: "How long do I have to return an unopened item for a full refund?",
    expectedDocs: ["refund-policy.md"],
    expectedFacts: ["30 days"],
  },
  {
    id: "refund-restocking",
    question: "Is there a restocking fee on returned furniture?",
    expectedDocs: ["refund-policy.md"],
    expectedFacts: ["15%"],
  },
  {
    id: "refund-damaged",
    question: "What should I do if my order arrives damaged?",
    expectedDocs: ["refund-policy.md"],
    expectedFacts: ["48 hours"],
  },
  // hours-and-contact.md
  {
    id: "hours-saturday",
    question: "What are your Saturday opening hours?",
    expectedDocs: ["hours-and-contact.md"],
    expectedFacts: ["10:00 AM", "4:00 PM"],
  },
  {
    id: "hours-phone",
    question: "What's your phone number?",
    expectedDocs: ["hours-and-contact.md"],
    expectedFacts: ["(416) 555-0142"],
  },
  {
    id: "hours-sunday",
    question: "Are you open on Sundays?",
    expectedDocs: ["hours-and-contact.md"],
    expectedFacts: ["Closed"],
  },
  // shipping-policy.md
  {
    id: "ship-free-threshold",
    question: "How much do I need to spend for free shipping?",
    expectedDocs: ["shipping-policy.md"],
    expectedFacts: ["$75"],
  },
  {
    id: "ship-express-cost",
    question: "How much extra is express shipping and how fast is it?",
    expectedDocs: ["shipping-policy.md"],
    expectedFacts: ["$19.95"],
  },
  {
    id: "ship-cutoff",
    question: "What's the cutoff time for same-day shipping?",
    expectedDocs: ["shipping-policy.md"],
    expectedFacts: ["1:00 PM"],
  },
  // pricing.md
  {
    id: "price-plus-tier",
    question: "What does the Plus membership cost and what do I get?",
    expectedDocs: ["pricing.md"],
    expectedFacts: ["$49", "10%"],
  },
  {
    id: "price-premier",
    question: "How much is the Premier membership per year?",
    expectedDocs: ["pricing.md"],
    expectedFacts: ["$99"],
  },
  {
    id: "price-match-window",
    question: "How long do I have to request a price match?",
    expectedDocs: ["pricing.md"],
    expectedFacts: ["7 days"],
  },
  // employee-handbook.md
  {
    id: "hb-vacation",
    question: "How many paid vacation days do full-time employees get?",
    expectedDocs: ["employee-handbook.md"],
    expectedFacts: ["15 days"],
  },
  {
    id: "hb-remote",
    question: "How many days a week can employees work remotely?",
    expectedDocs: ["employee-handbook.md"],
    expectedFacts: ["two days"],
  },
  {
    id: "hb-probation",
    question: "How long is the probation period for new employees?",
    expectedDocs: ["employee-handbook.md"],
    expectedFacts: ["90"],
  },
  {
    id: "hb-sick",
    question: "When do I need a doctor's note for sick leave?",
    expectedDocs: ["employee-handbook.md"],
    expectedFacts: ["three consecutive days"],
  },

  // Negatives — plausible questions the corpus does NOT answer.
  {
    id: "neg-warranty",
    question: "What is the warranty period on electronics?",
    expectedDocs: [],
    expectedFacts: [],
    negative: true,
  },
  {
    id: "neg-ceo",
    question: "Who is the CEO of the company?",
    expectedDocs: [],
    expectedFacts: [],
    negative: true,
  },
  {
    id: "neg-parking",
    question: "Is there free customer parking at the store?",
    expectedDocs: [],
    expectedFacts: [],
    negative: true,
  },
  {
    id: "neg-loyalty-points",
    question: "How many loyalty points do I earn per dollar spent?",
    expectedDocs: [],
    expectedFacts: [],
    negative: true,
  },
] as const;
