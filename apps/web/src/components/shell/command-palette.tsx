"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  CalendarRange,
  FileText,
  Loader2,
  MessagesSquare,
  Search,
  Sparkles,
  Upload,
  User,
  UserPlus,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Dialog, DialogPortal, DialogBackdrop, DialogPrimitive } from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";
import { allNav, type NavIcon } from "@/components/shell/nav";
import { fuzzyFilter } from "@/lib/search/fuzzy";
import { searchWorkspace } from "@/lib/search/actions";
import { EMPTY_RESULTS, type WorkspaceSearchResults } from "@/lib/search/types";

type Entry = {
  key: string;
  label: string;
  hint: string | null;
  icon: NavIcon;
  /** Either a route or an imperative action. */
  href?: string;
  perform?: () => void;
};

type Group = { label: string; entries: Entry[] };

const SEARCH_DEBOUNCE_MS = 180;
const MIN_QUERY = 2;

/**
 * The workspace command palette. ⌘K / Ctrl+K (bound by the topbar) or the
 * search button. Pages and actions match instantly with the shared fuzzy
 * scorer; conversations, documents and employees stream in from the
 * `searchWorkspace` server action (RLS-scoped, plan-aware).
 */
function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [active, setActive] = React.useState(0);
  const [remote, setRemote] = React.useState<WorkspaceSearchResults>(EMPTY_RESULTS);
  const [isSearching, startSearch] = React.useTransition();
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestRef = React.useRef(0);

  const actions: Entry[] = React.useMemo(
    () => [
      {
        key: "action-upload",
        label: "Upload a document",
        hint: "Knowledge",
        icon: Upload,
        href: "/knowledge",
      },
      {
        key: "action-conversation",
        label: "Start a conversation",
        hint: "AI Assistant",
        icon: Sparkles,
        href: "/assistant",
      },
      {
        key: "action-generate",
        label: "Generate a schedule draft",
        hint: "Scheduling",
        icon: CalendarRange,
        href: "/scheduling/calendar",
      },
      {
        key: "action-invite",
        label: "Invite a teammate",
        hint: "Settings",
        icon: UserPlus,
        href: "/settings/team",
      },
    ],
    [],
  );

  function reset() {
    setQuery("");
    setActive(0);
    setRemote(EMPTY_RESULTS);
    if (timerRef.current) clearTimeout(timerRef.current);
    requestRef.current += 1;
  }

  function onQueryChange(value: string) {
    setQuery(value);
    setActive(0);

    if (timerRef.current) clearTimeout(timerRef.current);
    const trimmed = value.trim();
    if (trimmed.length < MIN_QUERY) {
      requestRef.current += 1;
      setRemote(EMPTY_RESULTS);
      return;
    }
    const requestId = ++requestRef.current;
    timerRef.current = setTimeout(() => {
      startSearch(async () => {
        const results = await searchWorkspace(trimmed);
        if (requestRef.current === requestId) setRemote(results);
      });
    }, SEARCH_DEBOUNCE_MS);
  }

  const groups: Group[] = React.useMemo(() => {
    const pageEntries: Entry[] = fuzzyFilter(query, allNav, (item) => item.label, 7).map(
      (item) => ({
        key: `page-${item.href}`,
        label: item.label,
        hint: item.href,
        icon: item.icon,
        href: item.href,
      }),
    );
    const actionEntries = fuzzyFilter(query, actions, (a) => a.label, 5);

    const result: Group[] = [];
    if (pageEntries.length) result.push({ label: "Pages", entries: pageEntries });
    if (actionEntries.length) result.push({ label: "Actions", entries: actionEntries });
    if (remote.conversations.length) {
      result.push({
        label: "Conversations",
        entries: remote.conversations.map((hit) => ({
          key: `conv-${hit.id}`,
          label: hit.label,
          hint: hit.hint,
          icon: MessagesSquare,
          href: hit.href,
        })),
      });
    }
    if (remote.documents.length) {
      result.push({
        label: "Documents",
        entries: remote.documents.map((hit) => ({
          key: `doc-${hit.id}`,
          label: hit.label,
          hint: hit.hint,
          icon: FileText,
          href: hit.href,
        })),
      });
    }
    if (remote.employees.length) {
      result.push({
        label: "Employees",
        entries: remote.employees.map((hit) => ({
          key: `emp-${hit.id}`,
          label: hit.label,
          hint: hit.hint,
          icon: User,
          href: hit.href,
        })),
      });
    }
    return result;
  }, [query, actions, remote]);

  const flat = React.useMemo(() => groups.flatMap((g) => g.entries), [groups]);
  const activeIndex = flat.length ? Math.min(active, flat.length - 1) : 0;

  function run(entry: Entry) {
    onOpenChange(false);
    reset();
    if (entry.perform) entry.perform();
    else if (entry.href) router.push(entry.href);
  }

  function onInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((i) => Math.min(i + 1, flat.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const entry = flat[activeIndex];
      if (entry) run(entry);
    }
  }

  const showEmpty = flat.length === 0 && !isSearching && query.trim().length >= MIN_QUERY;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) reset();
      }}
    >
      <DialogPortal>
        <DialogBackdrop />
        <DialogPrimitive.Viewport className="z-overlay fixed inset-0 flex items-start justify-center overflow-y-auto p-4 pt-[12vh]">
          <DialogPrimitive.Popup className="bg-popover text-popover-foreground shadow-modal w-full max-w-xl overflow-hidden rounded-lg border border-border transition-all duration-200 ease-out data-[starting-style]:scale-95 data-[starting-style]:opacity-0 data-[ending-style]:scale-95 data-[ending-style]:opacity-0">
            <DialogPrimitive.Title className="sr-only">Command menu</DialogPrimitive.Title>

            <div className="flex items-center gap-2.5 border-b border-border/60 px-4">
              <Search className="text-muted-foreground size-4 shrink-0" />
              <input
                autoFocus
                value={query}
                onChange={(event) => onQueryChange(event.target.value)}
                onKeyDown={onInputKeyDown}
                placeholder="Search pages, actions, documents, people…"
                aria-label="Search pages, actions, documents, people"
                role="combobox"
                aria-expanded
                aria-controls="command-palette-results"
                aria-activedescendant={
                  flat.length ? `command-palette-option-${activeIndex}` : undefined
                }
                className="placeholder:text-muted-foreground h-12 w-full bg-transparent text-sm "
              />
              {isSearching ? (
                <Loader2
                  className="text-muted-foreground size-4 shrink-0 animate-spin"
                  aria-hidden
                />
              ) : (
                <Kbd className="hidden sm:inline-flex">esc</Kbd>
              )}
            </div>

            {/* Announced to screen readers as the result set changes. */}
            <p aria-live="polite" className="sr-only">
              {showEmpty
                ? "No matches."
                : `${flat.length} ${flat.length === 1 ? "result" : "results"}.`}
            </p>

            <div
              id="command-palette-results"
              role="listbox"
              aria-label="Results"
              className="max-h-96 overflow-y-auto p-2"
            >
              {showEmpty ? (
                <p className="text-muted-foreground px-3 py-6 text-center text-sm">
                  No matches for &ldquo;{query.trim()}&rdquo;.
                </p>
              ) : (
                groups.map((group) => {
                  // Index of this group's first entry in the flattened list.
                  const offset = flat.findIndex((e) => e.key === group.entries[0]?.key);
                  return (
                    <div key={group.label} className="mb-1 last:mb-0">
                      <p className="type-meta text-muted-foreground/70 px-3 pb-1 pt-2">
                        {group.label}
                      </p>
                      {group.entries.map((entry, index) => {
                        const flatIndex = offset + index;
                        return (
                          <PaletteRow
                            key={entry.key}
                            id={`command-palette-option-${flatIndex}`}
                            entry={entry}
                            isActive={flatIndex === activeIndex}
                            onSelect={run}
                            onHover={() => setActive(flatIndex)}
                          />
                        );
                      })}
                    </div>
                  );
                })
              )}
            </div>
          </DialogPrimitive.Popup>
        </DialogPrimitive.Viewport>
      </DialogPortal>
    </Dialog>
  );
}

function PaletteRow({
  id,
  entry,
  isActive,
  onSelect,
  onHover,
}: {
  id: string;
  entry: Entry;
  isActive: boolean;
  onSelect: (entry: Entry) => void;
  onHover: () => void;
}) {
  const Icon = entry.icon;
  return (
    <button
      id={id}
      role="option"
      aria-selected={isActive}
      type="button"
      onClick={() => onSelect(entry)}
      onMouseMove={onHover}
      data-active={isActive || undefined}
      className={cn(
        " flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors ",
        isActive ? "bg-primary-soft text-primary-soft-foreground" : "hover:bg-accent",
      )}
    >
      <Icon className="text-muted-foreground size-4 shrink-0" />
      <span className="min-w-0 flex-1 truncate">{entry.label}</span>
      {entry.hint ? (
        <span className="text-muted-foreground max-w-40 truncate text-xs">{entry.hint}</span>
      ) : null}
    </button>
  );
}

export { CommandPalette };
