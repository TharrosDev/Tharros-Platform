import * as React from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { visit, SKIP } from "unist-util-visit";

import { FileText } from "lucide-react";

import type { Citation } from "@/lib/documents/rag-prompt";
import { splitCitationText } from "@/lib/assistant/citation-markers";
import { cn } from "@/lib/utils";
import {
  PreviewCard,
  PreviewCardContent,
  PreviewCardTrigger,
} from "@/components/ui/preview-card";

/**
 * Day 29 — markdown for assistant turns, mapped to the Workshop type scale.
 * Claude returns GitHub-flavoured markdown; this renders it with the app's own
 * spacing, lists, links, and code styling rather than browser defaults. User
 * turns are plain text and never go through this.
 *
 * Day 30 — inline citation markers. A remark plugin rewrites `[n]` bracket
 * numbers into link nodes (`#cite-n`); the `a` component override below renders
 * each as a clickable cobalt source chip resolved against `citations`.
 */

/**
 * Rewrite `[n]` markers in text nodes into `#cite-n` link nodes for the `a`
 * renderer. Node types come from `visit`'s own inference (mdast types aren't
 * resolvable at the bare specifier under pnpm), so the few fields we touch are
 * read structurally.
 */
function remarkCitationMarkers() {
  return (tree: unknown) => {
    visit(tree as never, "text", (node, index, parent) => {
      const value = (node as { value?: string }).value;
      if (!parent || index === undefined || typeof value !== "string") return;
      const segments = splitCitationText(value);
      if (segments.length === 1 && segments[0].type === "text") return;

      const replacement = segments.map((seg) =>
        seg.type === "text"
          ? { type: "text", value: seg.value }
          : {
              type: "link",
              url: `#cite-${seg.n}`,
              children: [{ type: "text", value: String(seg.n) }],
            },
      );
      (parent as { children: unknown[] }).children.splice(index, 1, ...replacement);
      return [SKIP, index + replacement.length];
    });
  };
}

const BASE_COMPONENTS: Components = {
  p: ({ children }) => <p className="my-3 first:mt-0 last:mb-0">{children}</p>,
  h1: ({ children }) => <h2 className="type-h2 mt-5 mb-2 first:mt-0">{children}</h2>,
  h2: ({ children }) => <h3 className="type-h2 mt-5 mb-2 first:mt-0">{children}</h3>,
  h3: ({ children }) => <h4 className="mt-4 mb-2 font-semibold first:mt-0">{children}</h4>,
  ul: ({ children }) => <ul className="my-3 list-disc space-y-1 pl-5">{children}</ul>,
  ol: ({ children }) => <ol className="my-3 list-decimal space-y-1 pl-5">{children}</ol>,
  li: ({ children }) => <li className="pl-0.5">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  blockquote: ({ children }) => (
    <blockquote className="border-border text-muted-foreground my-3 border-l-2 pl-3 italic">
      {children}
    </blockquote>
  ),
  code: ({ className, children }) => {
    const isBlock = className?.includes("language-");
    if (isBlock) {
      return <code className={cn("font-mono text-[0.85em]", className)}>{children}</code>;
    }
    return (
      <code className="bg-muted text-foreground rounded px-1.5 py-0.5 font-mono text-[0.85em]">
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="bg-muted my-3 overflow-x-auto rounded-md p-3 text-[0.85em] leading-relaxed">
      {children}
    </pre>
  ),
  table: ({ children }) => (
    <div className="my-3 overflow-x-auto">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border-border border-b px-3 py-1.5 text-left font-semibold">{children}</th>
  ),
  td: ({ children }) => <td className="border-border/60 border-b px-3 py-1.5">{children}</td>,
  hr: () => <hr className="border-border my-4" />,
};

const REMARK_PLUGINS = [remarkGfm, remarkCitationMarkers];

/**
 * A clickable cobalt source chip rendered in place of a `[n]` marker. Hovering
 * (or focusing) shows a preview card with the source document, so the reader
 * can check a citation without leaving the answer; clicking still opens the
 * full sources dialog (and is the touch path).
 */
function CitationMarker({
  n,
  filename,
  passages,
  onClick,
}: {
  n: number;
  filename?: string;
  passages?: number;
  onClick: () => void;
}) {
  const chip = (
    <button
      type="button"
      onClick={onClick}
      aria-label={filename ? `Source ${n}: ${filename}` : `Source ${n}`}
      className="text-primary-soft-foreground bg-primary-soft hover:bg-primary-soft/70 focus-visible:ring-ring/40 inline-flex min-w-[1.1em] items-center justify-center rounded px-1 text-[0.7em] font-semibold tabular-nums outline-none transition-colors focus-visible:ring-2"
    >
      {n}
    </button>
  );

  if (!filename) return <sup className="mx-px">{chip}</sup>;

  return (
    <sup className="mx-px">
      <PreviewCard>
        <PreviewCardTrigger render={chip} />
        <PreviewCardContent>
          <div className="flex items-start gap-2.5">
            <span className="text-primary-soft-foreground bg-primary-soft flex size-5 shrink-0 items-center justify-center rounded text-xs font-semibold tabular-nums">
              {n}
            </span>
            <div className="min-w-0">
              <p className="text-foreground flex items-center gap-1.5 text-sm font-medium">
                <FileText className="text-muted-foreground size-3.5 shrink-0" />
                <span className="truncate" title={filename}>
                  {filename}
                </span>
              </p>
              <p className="text-muted-foreground mt-1 text-xs">
                {passages && passages > 0
                  ? `${passages} passage${passages === 1 ? "" : "s"} from this document. `
                  : null}
                Click to see every source.
              </p>
            </div>
          </div>
        </PreviewCardContent>
      </PreviewCard>
    </sup>
  );
}

export const AssistantMarkdown = React.memo(function AssistantMarkdown({
  content,
  citations = [],
  onCite,
}: {
  content: string;
  citations?: Citation[];
  onCite?: (index: number) => void;
}) {
  const components = React.useMemo<Components>(
    () => ({
      ...BASE_COMPONENTS,
      a: ({ children, href }) => {
        const match = typeof href === "string" ? /^#cite-(\d+)$/.exec(href) : null;
        if (match) {
          const n = Number(match[1]);
          const cite = citations.find((c) => c.index === n);
          // Unknown source number → render the literal marker, never a dead link.
          if (!cite && citations.length > 0) return <>[{n}]</>;
          return (
            <CitationMarker
              n={n}
              filename={cite?.filename}
              passages={cite?.chunkIndices.length}
              onClick={() => onCite?.(n)}
            />
          );
        }
        return (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary font-medium underline underline-offset-2 hover:no-underline"
          >
            {children}
          </a>
        );
      },
    }),
    [citations, onCite],
  );

  return (
    <div className="type-body text-foreground">
      <ReactMarkdown remarkPlugins={REMARK_PLUGINS} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
});
