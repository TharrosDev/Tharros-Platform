import { cn } from "@/lib/utils";

export type BarStripPoint = { label: string; value: number };

/**
 * Dependency-free bar strip for small daily series (server-renderable: plain
 * divs sized by percentage, token colors, no JS). Accessible twin: each bar
 * carries a title and the series is mirrored in a visually-hidden list.
 */
export function BarStrip({
  points,
  unit,
  className,
}: {
  points: BarStripPoint[];
  /** Unit suffix for titles and the hidden list, e.g. "h". */
  unit?: string;
  className?: string;
}) {
  const max = Math.max(...points.map((p) => p.value), 1);
  return (
    <figure className={cn("space-y-1", className)}>
      <div className="flex h-16 items-end gap-px" aria-hidden>
        {points.map((p) => (
          <div
            key={p.label}
            title={`${p.label}: ${p.value}${unit ?? ""}`}
            className={cn(
              "min-w-0 flex-1 rounded-t-[2px] transition-[height] duration-300 ease-out motion-reduce:transition-none",
              p.value > 0 ? "bg-primary/55 hover:bg-primary/75" : "bg-muted",
            )}
            style={{ height: `${p.value > 0 ? Math.max(6, (p.value / max) * 100) : 4}%` }}
          />
        ))}
      </div>
      <figcaption className="sr-only">
        <ul>
          {points.map((p) => (
            <li key={p.label}>
              {p.label}: {p.value}
              {unit ?? ""}
            </li>
          ))}
        </ul>
      </figcaption>
    </figure>
  );
}
