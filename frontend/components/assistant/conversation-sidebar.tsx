"use client";

import * as Dropdown from "@radix-ui/react-dropdown-menu";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { LoaderCircle, MessageSquare, MoreHorizontal, Pencil, Plus, SearchX, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { SearchInput } from "@/components/ui/search-input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { Conversation } from "@/lib/types/conversations";

interface ConversationSidebarProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  search: string;
  onSearchChange: (value: string) => void;
  onSelect: (conversationId: string) => void;
  onNew: () => void;
  onRename: (conversationId: string, title: string) => Promise<void>;
  onDelete: (conversationId: string) => Promise<void>;
  isLoading: boolean;
  isError: boolean;
  isCreating: boolean;
  retry: () => void;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
  className?: string;
}

function relativeTime(value: string) {
  const timestamp = new Date(value).getTime();
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  if (seconds < 60) return "Now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d`;
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(value));
}

export function ConversationSidebar({
  conversations,
  activeConversationId,
  search,
  onSearchChange,
  onSelect,
  onNew,
  onRename,
  onDelete,
  isLoading,
  isError,
  isCreating,
  retry,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
  className,
}: ConversationSidebarProps) {
  const loadMoreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = loadMoreRef.current;
    if (!element || !hasNextPage) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !isFetchingNextPage) fetchNextPage();
    }, { rootMargin: "120px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  return (
    <aside className={cn("flex min-h-0 flex-col border-r bg-card/55", className)} aria-label="Conversation history">
      <div className="border-b p-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">Conversations</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Your private AI history</p>
          </div>
          <Button type="button" size="icon" className="size-9" onClick={onNew} disabled={isCreating} aria-label="Start a new conversation">
            {isCreating ? <LoaderCircle className="size-4 animate-spin" /> : <Plus className="size-4" />}
          </Button>
        </div>
        <SearchInput
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search conversations"
          aria-label="Search conversations"
          className="w-full"
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
        {isLoading && <ConversationListSkeleton />}
        {isError && !isLoading && <ErrorState title="Conversations unavailable" description="We couldn’t load your conversation history." retry={retry} />}
        {!isLoading && !isError && conversations.length === 0 && (
          search ? (
            <EmptyState icon={SearchX} title="No matches" description="Try another title or message phrase." />
          ) : (
            <EmptyState icon={MessageSquare} title="No conversations yet" description="Start a conversation and your history will appear here." action={{ label: "Start a conversation", onClick: onNew }} />
          )
        )}
        {!isLoading && !isError && conversations.map((conversation) => (
          <ConversationRow
            key={conversation.id}
            conversation={conversation}
            active={conversation.id === activeConversationId}
            onSelect={onSelect}
            onRename={onRename}
            onDelete={onDelete}
          />
        ))}
        <div ref={loadMoreRef} className="grid h-12 place-items-center" aria-hidden={!isFetchingNextPage}>
          {isFetchingNextPage && <LoaderCircle className="size-4 animate-spin text-muted-foreground" />}
        </div>
      </div>
    </aside>
  );
}

function ConversationListSkeleton() {
  return (
    <div className="space-y-2 px-1" aria-label="Loading conversations" role="status">
      {Array.from({ length: 7 }).map((_, index) => (
        <div key={index} className="rounded-xl p-3">
          <div className="flex justify-between gap-3"><Skeleton className="h-4 w-3/5" /><Skeleton className="h-3 w-8" /></div>
          <Skeleton className="mt-2 h-3 w-4/5" />
        </div>
      ))}
    </div>
  );
}

function ConversationRow({
  conversation,
  active,
  onSelect,
  onRename,
  onDelete,
}: {
  conversation: Conversation;
  active: boolean;
  onSelect: (conversationId: string) => void;
  onRename: (conversationId: string, title: string) => Promise<void>;
  onDelete: (conversationId: string) => Promise<void>;
}) {
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [title, setTitle] = useState(conversation.title ?? "New conversation");
  const [saving, setSaving] = useState(false);
  const renameInputId = useId();

  const rename = async (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      await onRename(conversation.id, title.trim());
      setRenameOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    setSaving(true);
    try {
      await onDelete(conversation.id);
      setDeleteOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={cn("group relative mb-1 flex rounded-xl transition", active ? "bg-accent text-accent-foreground" : "hover:bg-muted/75")}>
      <button
        type="button"
        onClick={() => onSelect(conversation.id)}
        aria-current={active ? "page" : undefined}
        className="min-w-0 flex-1 rounded-xl px-3 py-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <span className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-sm font-medium">{conversation.title ?? "New conversation"}</span>
          <time className="shrink-0 text-[11px] text-muted-foreground" dateTime={conversation.updated_at}>{relativeTime(conversation.updated_at)}</time>
        </span>
        <span className="mt-1 block truncate text-xs text-muted-foreground">{conversation.last_message_preview || "No messages yet"}</span>
      </button>
      <Dropdown.Root>
        <Dropdown.Trigger asChild>
          <Button type="button" variant="ghost" size="icon" className="mr-1 mt-2 size-8 shrink-0 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 data-[state=open]:opacity-100" aria-label={`Conversation actions for ${conversation.title ?? "New conversation"}`}>
            <MoreHorizontal className="size-4" />
          </Button>
        </Dropdown.Trigger>
        <Dropdown.Portal>
          <Dropdown.Content align="end" sideOffset={4} className="z-50 min-w-36 rounded-lg border bg-card p-1 shadow-xl">
            <Dropdown.Item onSelect={() => { setTitle(conversation.title ?? "New conversation"); setRenameOpen(true); }} className="flex cursor-default items-center gap-2 rounded-md px-2.5 py-2 text-sm outline-none focus:bg-muted">
              <Pencil className="size-3.5" />Rename
            </Dropdown.Item>
            <Dropdown.Item onSelect={() => setDeleteOpen(true)} className="flex cursor-default items-center gap-2 rounded-md px-2.5 py-2 text-sm text-destructive outline-none focus:bg-destructive/10">
              <Trash2 className="size-3.5" />Delete
            </Dropdown.Item>
          </Dropdown.Content>
        </Dropdown.Portal>
      </Dropdown.Root>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogTitle className="text-lg font-semibold">Rename conversation</DialogTitle>
          <DialogDescription className="mt-1 text-sm text-muted-foreground">Choose a short name that makes this conversation easy to find.</DialogDescription>
          <form onSubmit={rename} className="mt-5 space-y-4">
            <label htmlFor={renameInputId} className="text-sm font-medium">Conversation name</label>
            <Input id={renameInputId} value={title} onChange={(event) => setTitle(event.target.value)} maxLength={250} autoFocus onFocus={(event) => event.currentTarget.select()} />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setRenameOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={!title.trim() || saving}>{saving && <LoaderCircle className="size-4 animate-spin" />}Save</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogTitle className="text-lg font-semibold">Delete conversation?</DialogTitle>
          <DialogDescription className="mt-2 text-sm leading-6 text-muted-foreground">This permanently removes the conversation and its message history. This action cannot be undone.</DialogDescription>
          <div className="mt-6 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button type="button" variant="destructive" onClick={remove} disabled={saving}>{saving && <LoaderCircle className="size-4 animate-spin" />}Delete</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
