import { cn } from "@/lib/utils";

/**
 * A section plate. The heading carries its own weight, so there is no label
 * floated above it.
 */
function SectionHeading({
  id,
  title,
  lede,
  className,
}: {
  id: string;
  title: string;
  lede?: string;
  className?: string;
}) {
  return (
    <div className={cn("border-rack-edge max-w-2xl border-b pb-5", className)}>
      <h2 id={id} className="type-hero text-rack-foreground">
        {title}
      </h2>
      {lede ? (
        <p className="text-rack-muted-foreground type-body mt-4 text-pretty sm:text-lg">{lede}</p>
      ) : null}
    </div>
  );
}

export { SectionHeading };
