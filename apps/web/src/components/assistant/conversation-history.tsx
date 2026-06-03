"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { History, Plus, MoreHorizontal, Pencil, Trash2, MessageSquare } from "lucide-react";

import type { Conversation } from "@/lib/assistant/types";
import {
  deleteConversation,
  loadMoreConversations,
  renameConversation,
} from "@/lib/assistant/actions";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";

/** Short relative-ish timestamp for the history list. */
function ago(iso: string): string {
  const then = new Date(iso).getTime();
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-CA", { month: "short", day: "numeric" });
}

export function ConversationHistory({
  conversations,
  initialNextCursor,
  activeId,
  viewerId,
}: {
  conversations: Conversation[];
  initialNextCursor: string | null;
  activeId: string | null;
  viewerId: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = React.useState(false);
  const [renaming, setRenaming] = React.useState<Conversation | null>(null);
  const [deleting, setDeleting] = React.useState<Conversation | null>(null);
  const [pending, startTransition] = React.useTransition();

  // `conversations` is the server-rendered first page (refreshes on mutation);
  // `extra` holds any keyset pages the user loaded. Display de-dupes by id.
  const [extra, setExtra] = React.useState<Conversation[]>([]);
  const [cursor, setCursor] = React.useState<string | null>(initialNextCursor);
  const [loadingMore, setLoadingMore] = React.useState(false);

  const items = React.useMemo(() => {
    const seen = new Set<string>();
    const out: Conversation[] = [];
    for (const c of [...conversations, ...extra]) {
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      out.push(c);
    }
    return out;
  }, [conversations, extra]);

  // After a mutation the first page is re-fetched server-side; drop loaded pages
  // so the list doesn't show stale/duplicated rows.
  function resetPages() {
    setExtra([]);
    setCursor(initialNextCursor);
  }

  async function loadMore() {
    if (!cursor) return;
    setLoadingMore(true);
    const res = await loadMoreConversations(cursor);
    setExtra((prev) => [...prev, ...res.conversations]);
    setCursor(res.nextCursor);
    setLoadingMore(false);
  }

  function runRename(title: string) {
    const target = renaming;
    if (!target) return;
    setRenaming(null);
    startTransition(async () => {
      const res = await renameConversation(target.id, title);
      if (res.error) toast.add({ title: "Couldn't rename", description: res.error });
      else {
        resetPages();
        router.refresh();
      }
    });
  }

  function runDelete() {
    const target = deleting;
    if (!target) return;
    setDeleting(null);
    startTransition(async () => {
      const res = await deleteConversation(target.id);
      if (res.error) {
        toast.add({ title: "Couldn't delete", description: res.error });
        return;
      }
      toast.add({ title: "Conversation deleted" });
      if (target.id === activeId) router.push("/assistant");
      else {
        resetPages();
        router.refresh();
      }
    });
  }

  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
          <History className="size-4" />
          History
        </SheetTrigger>
        <SheetContent
          side="right"
          className="bg-popover text-popover-foreground border-border w-80 max-w-[85vw]"
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="type-h2">Conversations</h2>
          </div>

          <div className="px-3 py-3">
            <Link
              href="/assistant"
              onClick={() => setOpen(false)}
              className={cn(buttonVariants({ variant: "soft" }), "w-full")}
            >
              <Plus className="size-4" />
              New chat
            </Link>
          </div>

          <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
            {items.length === 0 ? (
              <p className="text-muted-foreground px-2 py-6 text-center text-sm">
                No conversations yet.
              </p>
            ) : (
              <ul className="space-y-0.5">
                {items.map((c) => {
                  const active = c.id === activeId;
                  const showAsker = c.userId !== viewerId && c.askerName;
                  return (
                    <li key={c.id} className="group/item relative">
                      <Link
                        href={`/assistant?c=${c.id}`}
                        onClick={() => setOpen(false)}
                        className={cn(
                          "flex items-start gap-2.5 rounded-md px-2.5 py-2 pr-9 transition-colors",
                          active ? "bg-accent" : "hover:bg-accent/60",
                        )}
                      >
                        <MessageSquare className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                        <span className="min-w-0 flex-1">
                          <span className="text-foreground block truncate text-sm font-medium">
                            {c.title}
                          </span>
                          <span className="text-muted-foreground block truncate text-xs">
                            {showAsker ? `${c.askerName} · ` : ""}
                            {ago(c.updatedAt)}
                          </span>
                        </span>
                      </Link>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          aria-label={`Actions for ${c.title}`}
                          className="text-muted-foreground hover:bg-accent hover:text-foreground absolute right-1.5 top-1.5 inline-flex size-7 items-center justify-center rounded-md opacity-0 transition group-focus-within/item:opacity-100 group-hover/item:opacity-100 focus-visible:opacity-100 focus-visible:ring-ring/40 focus-visible:ring-2 outline-none"
                        >
                          <MoreHorizontal className="size-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem onClick={() => setRenaming(c)}>
                            <Pencil />
                            Rename
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => setDeleting(c)}>
                            <Trash2 />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </li>
                  );
                })}
              </ul>
            )}
            {cursor ? (
              <div className="px-2 pt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  onClick={() => void loadMore()}
                  disabled={loadingMore}
                >
                  {loadingMore ? "Loading…" : "Load older"}
                </Button>
              </div>
            ) : null}
          </nav>
        </SheetContent>
      </Sheet>

      {/* Rename */}
      <Dialog open={renaming !== null} onOpenChange={(o) => !o && setRenaming(null)}>
        <DialogContent className="max-w-md">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              runRename(String(fd.get("title") ?? ""));
            }}
          >
            <DialogHeader>
              <DialogTitle>Rename conversation</DialogTitle>
              <DialogDescription>Give this conversation a clearer name.</DialogDescription>
            </DialogHeader>
            <Input
              name="title"
              defaultValue={renaming?.title}
              maxLength={120}
              autoFocus
              className="my-4"
              aria-label="Conversation name"
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRenaming(null)} disabled={pending}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                Save name
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete */}
      <Dialog open={deleting !== null} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete conversation</DialogTitle>
            <DialogDescription>
              Delete &ldquo;{deleting?.title}&rdquo;? This removes the thread and its messages. This
              can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)} disabled={pending}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={runDelete} disabled={pending}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
