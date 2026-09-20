import { marketingContainer } from "@/components/marketing/marketing-chrome";
import { SectionHeading } from "./section-heading";

/*
  The lifecycle as the object itself: a strip moves left to right across the
  bays, and the only step a machine cannot take is the one in the middle.
*/
const BAYS = [
  {
    label: "Printed",
    by: "Tharros",
    body: "Work arrives as a strip: a schedule draft, a captured lead, an escalated sick call, a workflow run.",
  },
  {
    label: "Needs your initials",
    by: "You",
    body: "Anything consequential stops here. The strip carries an empty box that only a person can fill.",
    human: true,
  },
  {
    label: "Cleared",
    by: "Recorded",
    body: "The strip advances, the record prints the line, and what happened stays readable afterwards.",
  },
];

function OperatingModel() {
  return (
    <section aria-labelledby="model-heading" className="seam-t py-20 sm:py-28">
      <div className={marketingContainer}>
        <SectionHeading
          id="model-heading"
          title="AI does the groundwork. You sign it off."
          lede="The same three steps govern every surface, which is why the product stays predictable as it grows."
        />

        <ol className="mt-12 grid gap-px md:grid-cols-3">
          {BAYS.map((bay, index) => (
            <li
              key={bay.label}
              className={
                bay.human
                  ? "on-stock bg-stock-pending border-border flex min-w-0 flex-col border p-6 sm:p-8"
                  : "on-stock bg-card border-border flex min-w-0 flex-col border p-6 sm:p-8"
              }
            >
              <div className="flex items-baseline justify-between gap-3">
                <p className="type-meta text-muted-foreground">
                  {String(index + 1).padStart(2, "0")}
                </p>
                <p className="type-meta text-muted-foreground">{bay.by}</p>
              </div>
              <h3 className="type-h1 text-foreground mt-4">{bay.label}</h3>
              <p className="type-body text-muted-foreground mt-3 text-pretty">{bay.body}</p>
              {bay.human ? (
                <p className="border-foreground/45 text-foreground type-meta mt-6 border-2 border-dashed px-3 py-2">
                  A person signs here
                </p>
              ) : null}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export { OperatingModel };
