import { cn } from "@/lib/utils";
import { marketingContainer } from "@/components/marketing/marketing-chrome";
import { Reveal } from "./reveal";
import { SectionHeading } from "./section-heading";

const PRINCIPLES = [
  {
    title: "Grounded answers",
    body: "The assistant answers from your documents and cites them. When the answer isn't there, it says so.",
  },
  {
    title: "Reviewed schedules",
    body: "Generated schedules stay drafts until a manager reviews and publishes them.",
  },
  {
    title: "Drafted follow-up",
    body: "AI prepares follow-up drafts for your leads. A person reviews them. Nothing is sent silently.",
  },
  {
    title: "Durable automations",
    body: "Workflows run on a durable job runtime with retries. Every run is recorded, and any workflow can be paused or tested.",
  },
  {
    title: "Isolated by design",
    body: "Each organization's data is separated in the database itself, not by convention in the interface.",
  },
];

function Principles() {
  return (
    <section aria-labelledby="control-heading" className="relative py-24 sm:py-32">
      <div
        className={cn(
          marketingContainer,
          "grid grid-cols-[minmax(0,1fr)] gap-16 lg:grid-cols-12 lg:gap-10",
        )}
      >
        <div className="lg:col-span-5">
          <div className="lg:sticky lg:top-32">
            <SectionHeading
              id="control-heading"
              index="III"
              eyebrow="Human control"
              lines={["AI drafts.", "People decide."]}
              intro="Tharros is built to take work off your plate without taking decisions out of your hands."
            />
          </div>
        </div>
        <ol className="border-t lg:col-span-6 lg:col-start-7">
          {PRINCIPLES.map((item, i) => (
            <li key={item.title} className="border-b">
              <Reveal className="grid gap-3 py-8 sm:grid-cols-[4rem_1fr] sm:py-10">
                <span aria-hidden className="type-meta text-primary-soft-foreground pt-1.5">
                  0{i + 1}
                </span>
                <div>
                  <h3 className="text-xl font-[700] tracking-[-0.03em] sm:text-2xl">
                    {item.title}
                  </h3>
                  <p className="text-muted-foreground mt-2.5 max-w-lg text-base leading-relaxed sm:text-lg">
                    {item.body}
                  </p>
                </div>
              </Reveal>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export { Principles };
