"use client";

import { useRef, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  Check,
  CheckCircle2,
  FileText,
  RotateCcw,
  Users,
  Workflow,
} from "lucide-react";
import { cn } from "@/lib/utils";

const views = [
  { id: "knowledge", label: "Knowledge", icon: BookOpen },
  { id: "schedule", label: "Scheduling", icon: CalendarDays },
  { id: "leads", label: "Leads", icon: Users },
  { id: "automation", label: "Automation", icon: Workflow },
] as const;

export function WorkspaceDemo({ initial = 0 }: { initial?: number }) {
  const [active, setActive] = useState(initial);
  const [reviewed, setReviewed] = useState(false);
  const [drafted, setDrafted] = useState(false);
  const [tested, setTested] = useState(false);
  const [source, setSource] = useState(false);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  return (
    <div className="workspace-demo">
      <div className="demo-topline">
        <span className="demo-brand">Your workspace</span>
        <span className="demo-label">Interactive example</span>
      </div>
      <div className="demo-tabs" role="tablist" aria-label="Explore Tharros features">
        {views.map((view, index) => (
          <button
            key={view.id}
            ref={(el) => {
              tabs.current[index] = el;
            }}
            type="button"
            role="tab"
            id={`demo-tab-${view.id}`}
            aria-selected={active === index}
            aria-controls={`demo-panel-${view.id}`}
            tabIndex={active === index ? 0 : -1}
            onClick={() => setActive(index)}
            onKeyDown={(event) => {
              let next = index;
              if (event.key === "ArrowRight") next = (index + 1) % views.length;
              else if (event.key === "ArrowLeft") next = (index + views.length - 1) % views.length;
              else if (event.key === "Home") next = 0;
              else if (event.key === "End") next = views.length - 1;
              else return;
              event.preventDefault();
              setActive(next);
              tabs.current[next]?.focus();
            }}
          >
            <view.icon size={16} aria-hidden />
            <span>{view.label}</span>
          </button>
        ))}
      </div>
      <div
        className="demo-body"
        role="tabpanel"
        id={`demo-panel-${views[active].id}`}
        aria-labelledby={`demo-tab-${views[active].id}`}
        tabIndex={0}
      >
        {active === 0 && (
          <>
            <div className="demo-heading">
              <BookOpen aria-hidden />
              <div>
                <h3>A little clarity for your day.</h3>
                <p>Answers from your team’s own knowledge.</p>
              </div>
            </div>
            <div className="demo-question">
              What should a new team member do on their first day?
            </div>
            <div className="demo-answer">
              <p>
                Start with a welcome from your manager, review the team handbook, and work through
                the onboarding checklist together.
              </p>
              <button
                className="demo-source"
                onClick={() => setSource(!source)}
                aria-expanded={source}
                aria-controls="demo-source"
              >
                <FileText size={15} aria-hidden /> Team handbook · Onboarding {source ? "−" : "+"}
              </button>
              {source && (
                <p id="demo-source" className="demo-excerpt">
                  Example source: “On day one, the manager welcomes the team member and introduces
                  the handbook and onboarding checklist.”
                </p>
              )}
            </div>
            <div className="demo-note">
              <CheckCircle2 size={16} aria-hidden /> A source you can open. An answer you can check.
            </div>
          </>
        )}
        {active === 1 && (
          <>
            <div className="demo-heading">
              <CalendarDays aria-hidden />
              <div>
                <h3>A week that works for everyone.</h3>
                <p>Review your draft before sharing it.</p>
              </div>
            </div>
            <div className="demo-schedule">
              <div className="demo-week">
                <span>Team</span>
                <span>Mon</span>
                <span>Tue</span>
                <span>Wed</span>
              </div>
              {["Alex", "Jordan", "Sam"].map((name, i) => (
                <div className="demo-week" key={name}>
                  <strong>{name}</strong>
                  {[0, 1, 2].map((day) => (
                    <span key={day} className={cn("demo-shift", i === day && "demo-shift-off")}>
                      {i === day ? "Off" : "9–5"}
                    </span>
                  ))}
                </div>
              ))}
            </div>
            <div className="demo-action-row">
              <span className="demo-status">
                {reviewed ? "Reviewed in this example" : "Draft · ready for review"}
              </span>
              <button className="demo-action" onClick={() => setReviewed(!reviewed)}>
                {reviewed ? <RotateCcw size={15} aria-hidden /> : <Check size={15} aria-hidden />}
                {reviewed ? "Reset" : "Review draft"}
              </button>
            </div>
            <p className="demo-note" role="status">
              {reviewed
                ? "Draft reviewed in this example. No schedule was published."
                : "Your review comes before publishing. This example never contacts staff."}
            </p>
          </>
        )}
        {active === 2 && (
          <>
            <div className="demo-heading">
              <Users aria-hidden />
              <div>
                <h3>A new conversation, kept in view.</h3>
                <p>From first enquiry to a thoughtful next step.</p>
              </div>
            </div>
            <div className="demo-lead">
              <div className="demo-person">ML</div>
              <div>
                <strong>Morgan Lee</strong>
                <p>Example enquiry · Service availability</p>
              </div>
              <span className="demo-status">New</span>
            </div>
            <p className="demo-message">
              “We’d like to learn more about working with your team. What would the next step look
              like?”
            </p>
            <button className="demo-action" onClick={() => setDrafted(!drafted)}>
              {drafted ? "Hide example draft" : "See a follow-up draft"}
              <ArrowRight size={15} aria-hidden />
            </button>
            {drafted && (
              <div className="demo-excerpt">
                Hi Morgan, thanks for getting in touch. We’d be happy to understand what you need.
                Could you share a little more about your project and timing?
                <strong className="block mt-2">Draft only · review before sending</strong>
              </div>
            )}
          </>
        )}
        {active === 3 && (
          <>
            <div className="demo-heading">
              <Workflow aria-hidden />
              <div>
                <h3>The next step, already lined up.</h3>
                <p>Useful automation with a visible history.</p>
              </div>
            </div>
            <ol className="demo-workflow">
              <li>
                <Users size={18} aria-hidden />
                <div>
                  <strong>A new lead arrives</strong>
                  <p>From your public capture form</p>
                </div>
              </li>
              <li>
                <ArrowRight size={18} aria-hidden />
                <div>
                  <strong>Notify the manager</strong>
                  <p>The next action stays in your workspace</p>
                </div>
              </li>
              <li>
                <CheckCircle2 size={18} aria-hidden />
                <div>
                  <strong>Keep a record</strong>
                  <p>See the result in execution history</p>
                </div>
              </li>
            </ol>
            <button className="demo-action" onClick={() => setTested(!tested)}>
              {tested ? "Reset example" : "Try the example"}
              {tested ? <RotateCcw size={15} aria-hidden /> : <ArrowRight size={15} aria-hidden />}
            </button>
            <p role="status" className="demo-note">
              {tested
                ? "Example complete. In the product, each run has a recorded result."
                : "A demonstration only. No workflow runs against your data."}
            </p>
          </>
        )}
      </div>
      <div className="demo-footer">
        Illustrative content. Explore freely—nothing here changes a real workspace.
      </div>
    </div>
  );
}
