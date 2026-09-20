import { BookOpen, CalendarDays, Users, Workflow } from "lucide-react";

/*
  The four shipped surfaces, described in the words PRODUCT.md uses. Copy here
  states only what is implemented end to end: no connectors, no CRM
  integrations, no automatic customer email.
*/
const PRODUCTS = [
  {
    key: "knowledge",
    index: "01",
    label: "Knowledge",
    title: "AI Business Assistant",
    icon: BookOpen,
    body: "Upload your policies, guides and operating documents. Ask in plain words and get answers grounded in your own material, with the sources cited. When the documents do not cover it, the assistant says so.",
    tags: ["Grounded answers", "Citations", "Your documents only"],
  },
  {
    key: "scheduling",
    index: "02",
    label: "Scheduling",
    title: "AI Workforce Scheduling",
    icon: CalendarDays,
    body: "Collect availability, generate a schedule around real constraints, then review it before anything is published. Sick calls, replacements, swaps and time off are handled in the same place.",
    tags: ["Manager review", "Self-service", "Sick-call coverage"],
  },
  {
    key: "leads",
    index: "03",
    label: "Lead Capture",
    title: "Lead Capture",
    icon: Users,
    body: "Publish capture forms, add leads by hand and move them through a live pipeline with timelines and notes. AI prepares follow-up drafts. A person reviews every one.",
    tags: ["Public forms", "Pipeline", "Reviewed drafts"],
  },
  {
    key: "automations",
    index: "04",
    label: "Automations",
    title: "Native Automations",
    icon: Workflow,
    body: "When a lead arrives or changes status, durable workflows notify a manager, update the pipeline or prepare a follow-up draft. Every run is recorded, and you can pause or test any workflow.",
    tags: ["Lead events", "Durable runs", "Full history"],
  },
] as const;

type ProductKey = (typeof PRODUCTS)[number]["key"];

export { PRODUCTS };
export type { ProductKey };
