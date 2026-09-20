import { marketingContainer } from "@/components/marketing/marketing-chrome";
import { SectionHeading } from "./section-heading";

const PRINCIPLES = [
  {
    title: "Truth before breadth",
    body: "Pricing, navigation, plan gates and the software itself agree. We do not advertise a capability before it works end to end.",
  },
  {
    title: "Human control for consequential actions",
    body: "Follow-ups are drafted, not sent. Schedules are reviewed, not published. You can pause or test any workflow.",
  },
  {
    title: "Tenant isolation by default",
    body: "Organisation boundaries are enforced in the database, not left to client convention.",
  },
  {
    title: "Real data only",
    body: "Your workspace never shows invented customers, metrics, activity or workflow results.",
  },
];

/** Engraved plates: rule work and type, nothing else. */
function Principles() {
  return (
    <section aria-labelledby="principles-heading" className="seam-t py-20 sm:py-28">
      <div className={marketingContainer}>
        <SectionHeading
          id="principles-heading"
          title="How we build it."
          lede="These are constraints we hold ourselves to, not marketing language."
        />

        <dl className="border-rack-edge mt-12 border-t">
          {PRINCIPLES.map((principle) => (
            <div
              key={principle.title}
              className="border-rack-edge grid gap-2 border-b py-7 md:grid-cols-[18rem_minmax(0,1fr)] md:gap-10"
            >
              <dt className="type-h2 text-rack-foreground">{principle.title}</dt>
              <dd className="type-body text-rack-muted-foreground text-pretty">{principle.body}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

export { Principles };
