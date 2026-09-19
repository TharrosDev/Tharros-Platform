import { Check } from "lucide-react";

import { cn } from "@/lib/utils";
import { TharrosMark } from "@/components/brand/logo";
import { PRODUCTS, type ProductKey } from "./product-panels";

/**
 * Light Tharros workspace chrome shared by the story. The rail lists the four
 * products as one connected column: done steps keep a check, the active one
 * carries the cobalt state.
 */
function WorkspaceFrame({
  active,
  showRail = true,
  className,
  children,
}: {
  active: ProductKey;
  showRail?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const activeIndex = PRODUCTS.findIndex((p) => p.key === active);

  return (
    <div
      aria-hidden
      className={cn("bg-card overflow-hidden rounded-[1.5rem] border shadow-raised", className)}
    >
      <div className="bg-background/60 flex h-11 items-center gap-2 border-b px-4">
        <TharrosMark className="text-primary size-4" />
        <span className="text-sm font-semibold tracking-tight">Workspace</span>
        <span className="type-meta text-muted-foreground ml-auto hidden sm:inline">
          One organization
        </span>
      </div>
      <div className={cn("grid", showRail && "sm:grid-cols-[11rem_minmax(0,1fr)]")}>
        {showRail ? (
          <ul className="bg-background/40 relative hidden space-y-1 border-r p-3 sm:block">
            <span className="bg-border absolute top-8 bottom-8 left-[1.6rem] w-px" />
            {PRODUCTS.map((product, i) => {
              const Icon = product.icon;
              const state = i < activeIndex ? "done" : i === activeIndex ? "active" : "idle";
              return (
                <li
                  key={product.key}
                  className={cn(
                    "relative flex items-center gap-2.5 rounded-xl px-2 py-2.5 text-sm font-medium transition-colors duration-300",
                    state === "active"
                      ? "bg-primary-soft text-primary-soft-foreground"
                      : "text-muted-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "relative flex size-6 items-center justify-center rounded-md border transition-colors duration-300",
                      state === "active" && "border-primary bg-primary text-primary-foreground",
                      state === "done" && "border-primary/30 bg-card text-primary",
                      state === "idle" && "bg-card",
                    )}
                  >
                    {state === "done" ? <Check className="size-3.5" /> : <Icon className="size-3.5" />}
                  </span>
                  {product.label}
                </li>
              );
            })}
          </ul>
        ) : null}
        <div className="relative min-w-0 p-4 sm:p-6">{children}</div>
      </div>
    </div>
  );
}

export { WorkspaceFrame };
