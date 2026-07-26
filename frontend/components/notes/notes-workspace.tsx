"use client";

import { useQuery } from "@tanstack/react-query";
import { FileText, Plus, SearchX } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { NoteFormDialog } from "@/components/business/note-form-dialog";
import { SelectControl, TagPills, relativeDate } from "@/components/business/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
import { Skeleton } from "@/components/ui/skeleton";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useProtectedRoute } from "@/hooks/use-protected-route";
import { businessApi, businessKeys } from "@/lib/api/business";
import type { NoteFilters, NoteSort } from "@/lib/types/business";

const PAGE_SIZE = 24;

export function NotesWorkspace() {
  const { ready } = useProtectedRoute();
  const [search, setSearch] = useState(""); const debouncedSearch = useDebouncedValue(search.trim());
  const [scope, setScope] = useState<NoteFilters["scope"]>("all"); const [relation, setRelation] = useState("all"); const [tagId, setTagId] = useState(""); const [sort, setSort] = useState<NoteSort>("updated"); const [page, setPage] = useState(1); const [createOpen, setCreateOpen] = useState(false);
  const filters = useMemo<NoteFilters>(() => ({ search: debouncedSearch || undefined, scope, tagId: tagId || undefined, sort }), [debouncedSearch, scope, sort, tagId]);
  const notesQuery = useQuery({ queryKey: [...businessKeys.notes, "workspace", filters, page], queryFn: () => businessApi.notes.list(filters, (page - 1) * PAGE_SIZE, PAGE_SIZE), enabled: ready });
  const tagsQuery = useQuery({ queryKey: businessKeys.tags, queryFn: () => businessApi.tags.list(100), enabled: ready });
  const allNotes = notesQuery.data?.items ?? []; const notes = relation === "all" ? allNotes : allNotes.filter((note) => relation === "unlinked" ? !relationOf(note) : relationOf(note) === relation);
  const pages = Math.max(1, Math.ceil((notesQuery.data?.page.total ?? 0) / PAGE_SIZE));
  if (!ready) return <NotesSkeleton />;
  return <div className="min-w-0 space-y-6"><header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="text-2xl font-semibold tracking-[-.03em] sm:text-3xl">Notes</h1><p className="mt-1 text-sm text-muted-foreground">Markdown-ready context connected to the work and relationships it informs.</p></div><Button onClick={() => setCreateOpen(true)}><Plus className="size-4" />New note</Button></header>
    <section aria-label="Note search and filters" className="space-y-3 rounded-xl border bg-card p-3 shadow-card"><SearchInput value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search titles and note content…" aria-label="Search notes" /><div className="flex flex-wrap gap-2"><SelectControl aria-label="Filter by visibility" value={scope} onChange={(event) => { setScope(event.target.value as NoteFilters["scope"]); setPage(1); }}><option value="all">All visibility</option><option value="personal">Personal</option><option value="company">Company</option><option value="project">Project</option></SelectControl><SelectControl aria-label="Filter by relationship" value={relation} onChange={(event) => setRelation(event.target.value)}><option value="all">All relationships</option><option value="employee">Employees</option><option value="customer">Customers</option><option value="project">Projects</option><option value="task">Tasks</option><option value="document">Documents</option><option value="unlinked">Unlinked</option></SelectControl><SelectControl aria-label="Filter by tag" value={tagId} onChange={(event) => { setTagId(event.target.value); setPage(1); }}><option value="">All tags</option>{(tagsQuery.data?.items ?? []).map((tag) => <option key={tag.id} value={tag.id}>{tag.name}</option>)}</SelectControl><SelectControl aria-label="Sort notes" value={sort} onChange={(event) => { setSort(event.target.value as NoteSort); setPage(1); }}><option value="updated">Recently updated</option><option value="title">Title</option></SelectControl><span className="ml-auto self-center text-xs text-muted-foreground">{notesQuery.data?.page.total ?? 0} notes</span></div></section>
    {notesQuery.isLoading ? <NotesSkeleton compact /> : notesQuery.isError ? <ErrorState title="Notes could not be loaded" retry={() => void notesQuery.refetch()} /> : !notes.length ? <EmptyState icon={search ? SearchX : FileText} title="No matching notes" description="Create durable context or adjust the active filters." action={{ label: "Create note", onClick: () => setCreateOpen(true) }} /> : <div className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-3">{notes.map((note) => <Link key={note.id} href={`/notes/${note.id}`} className="group min-w-0 rounded-xl border bg-card p-5 shadow-card outline-none transition hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring"><div className="flex items-start justify-between gap-3"><h2 className="line-clamp-2 font-semibold group-hover:text-primary">{note.title}</h2><Badge variant="secondary" className="shrink-0 capitalize">{note.scope}</Badge></div><p className="mt-3 line-clamp-5 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{note.body}</p><div className="mt-4"><TagPills tags={note.tags} limit={4} /></div><div className="mt-4 flex items-center justify-between border-t pt-3 text-xs text-muted-foreground"><span>{relationLabel(note)}</span><span>{relativeDate(note.updated_at)}</span></div></Link>)}</div>}
    {notesQuery.data && pages > 1 && <Pagination page={page} pages={pages} onPageChange={setPage} />}<NoteFormDialog open={createOpen} onOpenChange={setCreateOpen} />
  </div>;
}

function relationOf(note: { employee_id: string | null; customer_id: string | null; project_id: string | null; task_id: string | null; document_id: string | null }) { return note.task_id ? "task" : note.customer_id ? "customer" : note.employee_id ? "employee" : note.document_id ? "document" : note.project_id ? "project" : null; }
function relationLabel(note: Parameters<typeof relationOf>[0]) { const relation = relationOf(note); return relation ? `Linked to ${relation}` : "No relationship"; }
function NotesSkeleton({ compact = false }: { compact?: boolean }) { return <div className="space-y-5" role="status" aria-label="Loading notes">{!compact && <Skeleton className="h-10 w-52" />}<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-64 rounded-xl" />)}</div></div>; }
