"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Link2, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { MarkdownMessage } from "@/components/assistant/markdown-message";
import { NoteFormDialog } from "@/components/business/note-form-dialog";
import { ActivityFeed, ConfirmDialog, TagPills, relativeDate } from "@/components/business/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useProtectedRoute } from "@/hooks/use-protected-route";
import { ApiRequestError } from "@/lib/api/client";
import { businessApi, businessKeys } from "@/lib/api/business";
import type { Note } from "@/lib/types/business";
import { toast } from "sonner";

export function NoteDetails() {
  const { noteId } = useParams<{ noteId: string }>(); const router = useRouter(); const queryClient = useQueryClient(); const { ready } = useProtectedRoute(); const [editOpen, setEditOpen] = useState(false); const [deleteOpen, setDeleteOpen] = useState(false);
  const noteQuery = useQuery({ queryKey: businessKeys.note(noteId), queryFn: () => businessApi.notes.get(noteId), enabled: ready });
  const employeesQuery = useQuery({ queryKey: businessKeys.employees, queryFn: () => businessApi.employees.list({}, 0, 100), enabled: ready });
  const activityQuery = useQuery({ queryKey: [...businessKeys.activity, "note", noteId], queryFn: () => businessApi.activity.list("note", noteId), enabled: ready, retry: false });
  const note = noteQuery.data; const employees = employeesQuery.data?.items ?? [];
  const removeMutation = useMutation({ mutationFn: () => businessApi.notes.remove(noteId), onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: businessKeys.notes }); toast.success("Note deleted"); router.replace("/notes"); }, onError: (error) => toast.error(error instanceof Error ? error.message : "Note could not be deleted") });
  if (!ready || noteQuery.isLoading) return <DetailsSkeleton />;
  if (noteQuery.isError || !note) return <ErrorState title="Note unavailable" description="It may have been deleted or be outside your visibility scope." retry={() => void noteQuery.refetch()} />;
  const activityUnavailable = activityQuery.error instanceof ApiRequestError && activityQuery.error.status === 403;
  return <div className="min-w-0 space-y-6"><Link href="/notes" className="inline-flex items-center gap-2 rounded-md text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"><ArrowLeft className="size-4" />Back to notes</Link><header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><Badge variant="secondary" className="capitalize">{note.scope}</Badge><span className="text-xs text-muted-foreground">Updated {relativeDate(note.updated_at)}</span></div><h1 className="mt-3 break-words text-2xl font-semibold tracking-[-.03em] sm:text-3xl">{note.title}</h1><div className="mt-3"><TagPills tags={note.tags} /></div></div><div className="flex gap-2"><Button variant="outline" onClick={() => setEditOpen(true)}><Pencil className="size-4" />Edit</Button><Button variant="ghost" size="icon" className="text-destructive" aria-label="Delete note" onClick={() => setDeleteOpen(true)}><Trash2 className="size-4" /></Button></div></header>
    <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(19rem,.6fr)]"><Card className="min-w-0"><CardContent className="p-5 sm:p-7"><MarkdownMessage content={note.body} /></CardContent></Card><aside className="space-y-6"><Card><CardHeader><CardTitle>Relationship</CardTitle></CardHeader><CardContent>{relation(note) ? <Link href={relation(note)!.href} className="flex items-center gap-2 rounded-lg border p-3 text-sm font-medium outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"><Link2 className="size-4 text-primary" />{relation(note)!.label}</Link> : <p className="text-sm text-muted-foreground">This note is not linked to another record.</p>}</CardContent></Card><Card><CardHeader><CardTitle>Activity history</CardTitle></CardHeader><CardContent><ActivityFeed items={activityQuery.data?.items} employees={employees} loading={activityQuery.isLoading} unavailable={activityUnavailable} /></CardContent></Card></aside></div>
    <NoteFormDialog open={editOpen} onOpenChange={setEditOpen} note={note} /><ConfirmDialog open={deleteOpen} onOpenChange={setDeleteOpen} title="Delete this note?" description="The note will be removed from active workspace views while its audit event remains retained." pending={removeMutation.isPending} onConfirm={() => removeMutation.mutate()} />
  </div>;
}

function relation(note: Note) { if (note.task_id) return { href: `/tasks/${note.task_id}`, label: "Linked task" }; if (note.project_id) return { href: `/projects/${note.project_id}`, label: "Linked project" }; if (note.customer_id) return { href: `/customers/${note.customer_id}`, label: "Linked customer" }; if (note.employee_id) return { href: `/employees/${note.employee_id}`, label: "Linked employee" }; if (note.document_id) return { href: "/documents", label: "Linked document" }; return null; }
function DetailsSkeleton() { return <div className="space-y-6" role="status" aria-label="Loading note"><Skeleton className="h-6 w-28" /><Skeleton className="h-28" /><div className="grid gap-6 xl:grid-cols-[1.4fr_.6fr]"><Skeleton className="h-96" /><Skeleton className="h-96" /></div></div>; }
