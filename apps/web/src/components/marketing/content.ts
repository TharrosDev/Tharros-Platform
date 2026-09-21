export const productDetails = [
  {
    slug: "business-assistant",
    name: "Business Assistant",
    short: "Knowledge",
    plan: "Every plan",
    title: "Your team's knowledge. Ready when you need it.",
    description:
      "Turn policies, guides and operating documents into answers your team can trace back to the source.",
    problem: "The answer exists. Finding it takes too long.",
    story:
      "Every organization builds up knowledge: how a process works, what a policy allows, where a new teammate should start. Tharros gives that information a shared home and a more natural way to find it.",
    steps: [
      "Upload your business documents to the knowledge library.",
      "Ask a question in everyday language.",
      "Read the answer alongside citations and check the source.",
    ],
    capabilities: [
      "Document ingestion and a shared knowledge library",
      "Answers grounded in your organization's material",
      "Source citations you can inspect",
      "Conversation history and generated content",
    ],
    boundary:
      "AI can make mistakes. Check cited material before acting on an answer, particularly for important decisions. Query limits vary by plan.",
    example: "Where can I find our onboarding checklist?",
    tone: "blue",
  },
  {
    slug: "workforce-scheduling",
    name: "Workforce Scheduling",
    short: "Scheduling",
    plan: "Growth and Pro",
    title: "Make the schedule. Make room for your team.",
    description:
      "Bring availability, schedule drafts, approvals and day-to-day changes into one shared workflow.",
    problem: "The schedule changes. Your whole day shouldn't have to.",
    story:
      "Availability, time off and last-minute gaps belong together. Tharros helps managers prepare and review a schedule, while employees have a place to see their shifts and submit changes.",
    steps: [
      "Set up your team, availability and scheduling requirements.",
      "Generate a draft and review the details.",
      "Publish when you're ready, then manage changes in the same workspace.",
    ],
    capabilities: [
      "AI-assisted schedule generation and manager review",
      "Employee availability, swaps and time-off requests",
      "Sick-call coverage and replacement workflows",
      "Schedule analytics and activity history",
    ],
    boundary:
      "Managers remain responsible for reviewing coverage, workplace requirements and the final schedule before publishing.",
    example: "Review next week's schedule before it goes to the team.",
    tone: "mint",
  },
  {
    slug: "lead-capture",
    name: "Lead Capture",
    short: "Leads",
    plan: "Growth and Pro",
    title: "Give every new enquiry a clear next step.",
    description:
      "Capture interest, keep the context and prepare a thoughtful follow-up without losing track of the conversation.",
    problem: "New opportunities need more than another inbox.",
    story:
      "A form submission is the beginning of a relationship. Keep enquiries in an organized pipeline with the notes, timeline and next action your team needs to move them forward.",
    steps: [
      "Share a public capture form or add a lead yourself.",
      "Keep notes and move the lead through your pipeline.",
      "Prepare an AI follow-up draft, then review it yourself.",
    ],
    capabilities: [
      "Public capture forms and a tokenized capture API",
      "Manual lead entry and pipeline statuses",
      "Lead timelines and internal notes",
      "Human-reviewed AI follow-up drafts",
    ],
    boundary:
      "Follow-ups are drafts. Tharros does not automatically send customer emails or provide external CRM synchronization.",
    example: "Prepare a follow-up for a new service enquiry.",
    tone: "peach",
  },
  {
    slug: "automations",
    name: "Native Automations",
    short: "Automations",
    plan: "Pro",
    title: "Less remembering. More moving forward.",
    description:
      "Let lead events start useful internal work, with clear controls and a history of every run.",
    problem: "Routine follow-through shouldn't depend on memory.",
    story:
      "When a lead arrives or changes status, Tharros can start a workflow inside your workspace. Notify a manager, update the pipeline or prepare a draft, and keep a record of what happened.",
    steps: [
      "Choose a lead event and the action it should start.",
      "Test the workflow before relying on it.",
      "Review execution history, and pause the workflow whenever needed.",
    ],
    capabilities: [
      "Lead-created and lead-status triggers",
      "Manager notifications and pipeline updates",
      "Automatic preparation of follow-up drafts",
      "Recorded executions, testing and pause controls",
    ],
    boundary:
      "Automations operate within Tharros. Third-party connectors and automatic customer email sending are not included.",
    example: "A new lead arrives. The right manager gets notified.",
    tone: "lavender",
  },
] as const;

export const commonQuestions = [
  {
    q: "What is Tharros?",
    a: "Tharros is a shared operating workspace for business knowledge, workforce scheduling, lead capture and native automations. The features available to your organization depend on your plan.",
  },
  {
    q: "Who is it for?",
    a: "Canadian business owners, managers and teams—from small businesses to larger organizations evaluating a shared operations workspace. Start with the workflows you need, and review your access, procurement and capacity requirements before a wider rollout.",
  },
  {
    q: "Does AI make decisions for us?",
    a: "Managers review schedules before publishing. Lead follow-ups are prepared as drafts. Native automations can perform configured internal actions, such as notifying managers or updating pipeline status, and record each execution.",
  },
  {
    q: "Can employees use it too?",
    a: "Growth and Pro include an employee portal for schedules, availability, swaps and time off. Employees access their portal through their dedicated link.",
  },
  {
    q: "Does it connect to our existing tools?",
    a: "Tharros currently brings its own four product areas together. External SaaS connectors and CRM synchronization are not currently included. Lead Capture includes public forms and a tokenized capture API.",
  },
  {
    q: "How should a larger organization evaluate Tharros?",
    a: "Begin with a defined team and workflow. Compare plan limits, access controls and data handling against your requirements. Contact us about your rollout before assuming that enterprise-specific requirements are supported.",
  },
];
