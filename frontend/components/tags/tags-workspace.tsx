"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, SearchX, Tags, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ConfirmDialog, tagUsageCount } from "@/components/business/shared";
import { TagFormDialog } from "@/components/business/tag-form-dialog";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { SearchInput } from "@/components/ui/search-input";
import { Skeleton } from "@/components/ui/skeleton";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useProtectedRoute } from "@/hooks/use-protected-route";
import { businessApi, businessKeys } from "@/lib/api/business";
import type { Tag } from "@/lib/types/business";
import { toast } from "sonner";

export function TagsWorkspace() {
  const { ready, user } = useProtectedRoute(); const queryClient = useQueryClient(); const [search, setSearch] = useState(""); const debouncedSearch = useDebouncedValue(search.trim()); const [createOpen, setCreateOpen] = useState(false); const [editing, setEditing] = useState<Tag | null>(null); const [deleting, setDeleting] = useState<Tag | null>(null);
  const tagsQuery = useQuery({ queryKey: [...businessKeys.tags, "workspace", debouncedSearch], queryFn: () => businessApi.tags.list({ search: debouncedSearch || undefined }, 0, 100), enabled: ready });
  const removeMutation = useMutation({ mutationFn: (id: string) => businessApi.tags.remove(id), onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: businessKeys.tags }); toast.success("Tag deleted"); setDeleting(null); }, onError: (error) => toast.error(error instanceof Error ? error.message : "Tag could not be deleted") });
  const canManage = user?.role !== "employee"; const tags = tagsQuery.data?.items ?? [];
  if (!ready) return <TagsSkeleton />;
  return <div className="min-w-0 space-y-6"><header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="text-2xl font-semibold tracking-[-.03em] sm:text-3xl">Tags</h1><p className="mt-1 text-sm text-muted-foreground">A consistent classification system across customers, projects, tasks, and notes.</p></div>{canManage && <Button onClick={() => setCreateOpen(true)}><Plus className="size-4" />New tag</Button>}</header><section className="rounded-xl border bg-card p-3 shadow-card"><SearchInput value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search tags…" aria-label="Search tags" /></section>
    {tagsQuery.isLoading ? <TagsSkeleton compact /> : tagsQuery.isError ? <ErrorState title="Tags could not be loaded" retry={() => void tagsQuery.refetch()} /> : !tags.length ? <EmptyState icon={search ? SearchX : Tags} title="No matching tags" description="Create a reusable label or adjust your search." action={canManage ? { label: "Create tag", onClick: () => setCreateOpen(true) } : undefined} /> : <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{tags.map((tag) => <article key={tag.id} className="rounded-xl border bg-card p-5 shadow-card"><div className="flex items-start gap-3"><span className="mt-1 size-3 shrink-0 rounded-full ring-4 ring-muted" style={{ backgroundColor: tag.color ?? "var(--primary)" }} /><div className="min-w-0 flex-1"><Link href={`/tags/${tag.id}`} className="block truncate rounded-sm font-semibold outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring">{tag.name}</Link><p className="mt-1 text-xs text-muted-foreground">{tagUsageCount(tag)} linked records</p></div>{canManage && <div className="flex"><Button variant="ghost" size="icon" className="size-8" aria-label={`Edit ${tag.name}`} onClick={() => setEditing(tag)}><Pencil className="size-3.5" /></Button><Button variant="ghost" size="icon" className="size-8 text-destructive" aria-label={`Delete ${tag.name}`} onClick={() => setDeleting(tag)}><Trash2 className="size-3.5" /></Button></div>}</div><div className="mt-5 grid grid-cols-4 gap-1 text-center"><Usage label="Customers" value={tag.customer_count} /><Usage label="Projects" value={tag.project_count} /><Usage label="Tasks" value={tag.task_count} /><Usage label="Notes" value={tag.note_count} /></div></article>)}</div>}
    <TagFormDialog open={createOpen} onOpenChange={setCreateOpen} /><TagFormDialog open={Boolean(editing)} onOpenChange={(open) => { if (!open) setEditing(null); }} tag={editing} /><ConfirmDialog open={Boolean(deleting)} onOpenChange={(open) => { if (!open) setDeleting(null); }} title="Delete this tag?" description="The label will be removed from linked records without deleting those records." pending={removeMutation.isPending} onConfirm={() => deleting && removeMutation.mutate(deleting.id)} />
  </div>;
}

function Usage({ label, value }: { label: string; value: number }) { return <div className="min-w-0 rounded-md bg-muted/55 px-1 py-2"><p className="font-semibold tabular-nums">{value}</p><p className="truncate text-[10px] text-muted-foreground">{label}</p></div>; }
function TagsSkeleton({ compact = false }: { compact?: boolean }) { return <div className="space-y-5" role="status" aria-label="Loading tags">{!compact && <Skeleton className="h-10 w-52" />}<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 8 }, (_, index) => <Skeleton key={index} className="h-44 rounded-xl" />)}</div></div>; }
