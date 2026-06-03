import * as React from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

import { cn } from "@/lib/utils";

/**
 * Day 29 — markdown for assistant turns, mapped to the Workshop type scale.
 * Claude returns GitHub-flavoured markdown; this renders it with the app's own
 * spacing, lists, links, and code styling rather than browser defaults. User
 * turns are plain text and never go through this.
 */
const COMPONENTS: Components = {
  p: ({ children }) => <p className="my-3 first:mt-0 last:mb-0">{children}</p>,
  h1: ({ children }) => <h2 className="type-h2 mt-5 mb-2 first:mt-0">{children}</h2>,
  h2: ({ children }) => <h3 className="type-h2 mt-5 mb-2 first:mt-0">{children}</h3>,
  h3: ({ children }) => <h4 className="mt-4 mb-2 font-semibold first:mt-0">{children}</h4>,
  ul: ({ children }) => <ul className="my-3 list-disc space-y-1 pl-5">{children}</ul>,
  ol: ({ children }) => <ol className="my-3 list-decimal space-y-1 pl-5">{children}</ol>,
  li: ({ children }) => <li className="pl-0.5">{children}</li>,
  a: ({ children, href }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary font-medium underline underline-offset-2 hover:no-underline"
    >
      {children}
    </a>
  ),
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

export const AssistantMarkdown = React.memo(function AssistantMarkdown({
  content,
}: {
  content: string;
}) {
  return (
    <div className="type-body text-foreground">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={COMPONENTS}>
        {content}
      </ReactMarkdown>
    </div>
  );
});
