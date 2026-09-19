import { cn } from "@/lib/utils";
import { MaskedLines, Reveal } from "./reveal";

/** Mono index + eyebrow over an editorial display heading. */
function SectionHeading({
  id,
  index,
  eyebrow,
  lines,
  intro,
  className,
}: {
  id: string;
  index: string;
  eyebrow: string;
  /** First line in ink, following lines muted. */
  lines: string[];
  intro?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("max-w-5xl", className)}>
      <Reveal>
        <p className="type-meta text-muted-foreground flex items-center gap-3">
          <span className="text-primary-soft-foreground">{index}</span>
          <span aria-hidden className="bg-border h-px w-8" />
          {eyebrow}
        </p>
      </Reveal>
      <h2
        id={id}
        className="mt-6 text-[clamp(2.4rem,5.4vw,4.75rem)] font-[720] leading-[0.95] tracking-[-0.05em] text-balance"
      >
        <MaskedLines
          lines={lines.map((text, i) => ({
            text,
            className: i === 0 ? undefined : "text-muted-foreground",
          }))}
        />
      </h2>
      {intro ? (
        <Reveal delay={0.15}>
          <p className="text-muted-foreground mt-7 max-w-xl text-lg leading-relaxed text-pretty">
            {intro}
          </p>
        </Reveal>
      ) : null}
    </div>
  );
}

export { SectionHeading };
