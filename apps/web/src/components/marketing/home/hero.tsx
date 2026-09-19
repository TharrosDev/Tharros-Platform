"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import {
  m,
  useMotionValue,
  useSpring,
  useTransform,
  type MotionValue,
} from "motion/react";
import { useReducedMotionSafe } from "@/components/motion/reduced-motion";

import { cn } from "@/lib/utils";
import { TharrosMark } from "@/components/brand/logo";
import { buttonVariants } from "@/components/ui/button";
import { marketingContainer } from "@/components/marketing/marketing-chrome";
import { PRODUCTS } from "./product-panels";
import { EASE_OUT, MaskedLines } from "./reveal";

/** CSS entrance delay; the animation itself lives in globals.css. */
const delay = (s: number) => ({ animationDelay: `${s}s` });

const PROOF = ["14-day free trial", "Human-controlled AI", "Answers cite their sources"];

function Hero() {
  return (
    <section aria-labelledby="hero-heading" className="relative pt-8 pb-16 sm:pt-12 lg:pb-20">
      <div className={cn(marketingContainer, "grid grid-cols-[minmax(0,1fr)] gap-y-10 lg:grid-cols-12 lg:gap-x-10")}>
        <p style={delay(0)} className="animate-fade-up type-meta text-muted-foreground flex items-center gap-3 lg:col-span-12">
          <span className="bg-primary size-1.5 rounded-full" aria-hidden />
          The operating workspace for small business
        </p>

        <h1
          id="hero-heading"
          className="-mt-4 text-[clamp(3.1rem,8.6vw,8.25rem)] leading-[0.88] font-[760] tracking-[-0.065em] lg:col-span-12"
        >
          <MaskedLines
            onMount
            delay={0.1}
            lines={[{ text: "Run the business." }, { text: "Not the busywork.", className: "text-primary" }]}
          />
        </h1>

        <div className="lg:col-span-5 lg:pt-4">
          <p style={delay(0.45)} className="animate-fade-up text-muted-foreground max-w-md text-lg leading-relaxed text-pretty sm:text-xl">
            Tharros brings your knowledge, scheduling, lead capture and automations into one
            workspace. AI does the groundwork. Your team stays in control of every decision.
          </p>

          <div style={delay(0.55)} className="animate-fade-up mt-9 flex flex-wrap items-center gap-3">
            <Link href="/signup" className={cn(buttonVariants({ size: "lg" }), "group h-13 px-7 text-base")}>
              Start free
              <ArrowRight className="transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
            </Link>
            <Link href="/pricing" className={cn(buttonVariants({ size: "lg", variant: "outline" }), "h-13 px-7 text-base")}>
              Explore plans
            </Link>
          </div>

          <ul style={delay(0.65)} className="animate-fade-up mt-10 space-y-2.5 border-t pt-6">
            {PROOF.map((item) => (
              <li key={item} className="text-muted-foreground flex items-center gap-3 text-sm">
                <span className="bg-primary h-px w-4" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div style={delay(0.35)} className="animate-fade-up lg:col-span-7 lg:-mt-6">
          <OperatingLayer />
        </div>
      </div>
    </section>
  );
}

/* Node anchors in the 500×340 diagram space (percent positions mirror them). */
const NODES = [
  { key: "knowledge", state: "Sources cited", pos: "left-0 top-0", path: "M250 170 C 190 170 110 150 110 70" },
  { key: "scheduling", state: "Draft to review", pos: "right-0 top-0", path: "M250 170 C 310 170 390 150 390 70" },
  { key: "leads", state: "Draft for review", pos: "left-0 bottom-0", path: "M250 170 C 190 170 110 190 110 270" },
  { key: "automations", state: "Run recorded", pos: "right-0 bottom-0", path: "M250 170 C 310 170 390 190 390 270" },
] as const;

/**
 * The hero visual: four products wired into one hub. A signal travels each
 * connector and the focus cycles node to node, showing work moving through a
 * single layer. Tilts toward a fine pointer; static under reduced motion.
 */
function OperatingLayer() {
  const reduced = useReducedMotionSafe();
  const [focus, setFocus] = useState(0);
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const sx = useSpring(px, { stiffness: 120, damping: 20 });
  const sy = useSpring(py, { stiffness: 120, damping: 20 });
  const rotateX = useTransform(sy, [-0.5, 0.5], [5, -5]);
  const rotateY = useTransform(sx, [-0.5, 0.5], [-7, 7]);

  useEffect(() => {
    if (reduced) return;
    const id = window.setInterval(() => setFocus((f) => (f + 1) % NODES.length), 2600);
    return () => window.clearInterval(id);
  }, [reduced]);

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    // Depth only for a mouse on large screens; touch and reduced motion stay flat.
    if (reduced || e.pointerType !== "mouse" || window.innerWidth < 1024) return;
    const r = e.currentTarget.getBoundingClientRect();
    px.set((e.clientX - r.left) / r.width - 0.5);
    py.set((e.clientY - r.top) / r.height - 0.5);
  }
  function onPointerLeave() {
    px.set(0);
    py.set(0);
  }

  return (
    <div
      className="relative [perspective:1400px]"
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
    >
      <p className="sr-only">
        Diagram: Knowledge, Scheduling, Lead Capture and Automations connected to one Tharros
        workspace.
      </p>
      <m.div
        aria-hidden
        style={{ rotateX, rotateY }}
        className="bg-card relative overflow-hidden rounded-[2rem] border p-3 shadow-raised sm:p-5 [transform-style:preserve-3d]"
      >
        {/* Canvas texture: dot grid + cobalt wash, kept inside the slab. */}
        <div
          className="text-foreground absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: "radial-gradient(currentColor 1px, transparent 1px)",
            backgroundSize: "18px 18px",
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 50% 50%, color-mix(in oklch, var(--primary) 12%, transparent), transparent 55%)",
          }}
        />

        <div className="relative aspect-[50/34]">
          <svg viewBox="0 0 500 340" className="absolute inset-0 size-full" fill="none">
            {NODES.map((node, i) => (
              <g key={node.key}>
                <m.path
                  d={node.path}
                  className="stroke-border"
                  strokeWidth={2}
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 1.1, ease: EASE_OUT, delay: 0.8 + i * 0.1 }}
                />
                <path
                  d={node.path}
                  className={cn(
                    "stroke-primary flow-dash transition-opacity duration-500",
                    focus === i ? "opacity-100" : "opacity-30",
                  )}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeDasharray="4 20"
                />
              </g>
            ))}
          </svg>

          {/* Hub */}
          <Layer x={sx} y={sy} depth={8} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
            <m.div
              initial={{ opacity: 0, scale: reduced ? 1 : 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.7, ease: EASE_OUT, delay: 0.6 }}
              className="bg-primary text-primary-foreground flex flex-col items-center gap-1.5 rounded-2xl px-4 py-3 shadow-raised sm:px-6 sm:py-4"
            >
              <TharrosMark className="size-5 sm:size-6" />
              <span className="text-xs font-semibold whitespace-nowrap sm:text-sm">One workspace</span>
            </m.div>
          </Layer>

          {NODES.map((node, i) => {
            const product = PRODUCTS.find((p) => p.key === node.key)!;
            const Icon = product.icon;
            return (
              <Layer key={node.key} x={sx} y={sy} depth={22} className={cn("absolute w-[44%]", node.pos)}>
                <m.div
                  initial={{ opacity: 0, y: reduced ? 0 : 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.7, ease: EASE_OUT, delay: 0.75 + i * 0.1 }}
                  className={cn(
                    "bg-card rounded-2xl border p-3 transition-[border-color,box-shadow] duration-500 sm:p-4",
                    focus === i ? "border-primary/40 shadow-raised" : "shadow-card",
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "flex size-7 shrink-0 items-center justify-center rounded-lg transition-colors duration-500",
                        focus === i ? "bg-primary text-primary-foreground" : "bg-primary-soft text-primary-soft-foreground",
                      )}
                    >
                      <Icon className="size-3.5" />
                    </span>
                    <span className="truncate text-sm font-semibold tracking-tight">{product.label}</span>
                  </div>
                  <p className="type-meta text-muted-foreground mt-3 hidden truncate sm:block">
                    <span className="text-primary">{product.index}</span> · {node.state}
                  </p>
                </m.div>
              </Layer>
            );
          })}
        </div>
      </m.div>
    </div>
  );
}

/** Parallax layer: nearer layers (higher depth) travel further with the pointer. */
function Layer({
  x,
  y,
  depth,
  className,
  children,
}: {
  x: MotionValue<number>;
  y: MotionValue<number>;
  depth: number;
  className?: string;
  children: React.ReactNode;
}) {
  const tx = useTransform(x, (v) => v * depth);
  const ty = useTransform(y, (v) => v * depth);
  return (
    <m.div className={className} style={{ translateX: tx, translateY: ty }}>
      {children}
    </m.div>
  );
}

export { Hero };
