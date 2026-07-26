"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CalendarDays, FileText, LoaderCircle, MessageSquare, Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { ActivityFeed, ConfirmDialog, EmployeeChip, PriorityBadge, ProgressBar, SelectControl, TASK_STATUSES, TagPills, TaskStatusBadge, formatDate, relativeDate, taskStatusLabel } from "@/components/business/shared";
import { NoteFormDialog } from "@/components/business/note-form-dialog";
import { TaskFormDialog } from "@/components/business/task-form-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { ApiRequestError } from "@/lib/api/client";
import { businessApi, businessKeys } from "@/lib/api/business";
import { useProtectedRoute } from "@/hooks/use-protected-route";
import { commentSchema, type CommentValues } from "@/lib/validations/business";
import type { TaskStatus } from "@/lib/types/business";

export function TaskDetails() {
  const params = useParams<{ taskId: string }>();
  const taskId = params.taskId;
  const router = useRouter();
  const queryClient = useQueryClient();
  const { ready, user } = useProtectedRoute();
  const [editOpen, setEditOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const taskQuery = useQuery({ queryKey: businessKeys.task(taskId), queryFn: () => businessApi.tasks.get(taskId), enabled: ready && Boolean(taskId) });
  const projectId = taskQuery.data?.project_id;
  const projectQuery = useQuery({ queryKey: businessKeys.project(projectId ?? "none"), queryFn: () => businessApi.projects.get(projectId!), enabled: ready && Boolean(projectId) });
  const employeesQuery = useQuery({ queryKey: businessKeys.employees, queryFn: () => businessApi.employees.list(), enabled: ready });
  const tagsQuery = useQuery({ queryKey: businessKeys.tags, queryFn: () => businessApi.tags.list(), enabled: ready });
  const notesQuery = useQuery({ queryKey: [...businessKeys.notes, "task", taskId], queryFn: () => businessApi.notes.list({ taskId }), enabled: ready && Boolean(taskId) });
  const activityQuery = useQuery({ queryKey: [...businessKeys.activity, "task", taskId], queryFn: () => businessApi.activity.list("task", taskId), enabled: ready && Boolean(taskId), retry: false });
  const employees = employeesQuery.data?.items ?? [];
  const task = taskQuery.data;
  const project = projectQuery.data;
  const assignee = employees.find((employee) => employee.id === task?.assignee_id);
  const activityUnavailable = activityQuery.error instanceof ApiRequestError && activityQuery.error.status === 403;
  const canDelete = user?.role !== "employee";
  const updateStatus = useMutation({ mutationFn: (status: TaskStatus) => businessApi.tasks.update(taskId, { status, progress: status === "done" ? 100 : undefined }), onSuccess: async () => { await Promise.all([queryClient.invalidateQueries({ queryKey: businessKeys.task(taskId) }), queryClient.invalidateQueries({ queryKey: businessKeys.tasks })]); toast.success("Task status updated"); }, onError: (error) => toast.error(error instanceof Error ? error.message : "Status could not be updated") });
  const removeMutation = useMutation({ mutationFn: () => businessApi.tasks.remove(taskId), onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: businessKeys.tasks }); toast.success("Task deleted"); router.replace("/tasks"); }, onError: (error) => toast.error(error instanceof Error ? error.message : "Task could not be deleted") });
  const commentForm = useForm<CommentValues>({ resolver: zodResolver(commentSchema), defaultValues: { body: "" } });
  const commentMutation = useMutation({ mutationFn: (values: CommentValues) => businessApi.tasks.comment(taskId, values.body), onSuccess: async () => { commentForm.reset(); await queryClient.invalidateQueries({ queryKey: businessKeys.task(taskId) }); toast.success("Comment added"); }, onError: (error) => toast.error(error instanceof Error ? error.message : "Comment could not be added") });

  if (!ready || taskQuery.isLoading) return <TaskDetailsSkeleton />;
  if (taskQuery.isError || !task) return <ErrorState title="Task unavailable" description="It may have been deleted, or it may be outside your assignment scope." retry={() => void taskQuery.refetch()} />;
  return <div className="min-w-0 space-y-6">
    <Link href="/tasks" className="inline-flex items-center gap-2 rounded-md text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"><ArrowLeft className="size-4" />Back to tasks</Link>
    <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><TaskStatusBadge status={task.status} /><PriorityBadge priority={task.priority} /><span className="text-xs text-muted-foreground">Updated {relativeDate(task.updated_at)}</span></div><h1 className="mt-3 break-words text-2xl font-semibold tracking-[-.03em] sm:text-3xl">{task.title}</h1><p className="mt-2 max-w-3xl whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{task.description || "No task description has been added yet."}</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => setEditOpen(true)}><Pencil className="size-4" />Edit</Button>{canDelete && <Button variant="ghost" size="icon" className="text-destructive" aria-label="Delete task" onClick={() => setDeleteOpen(true)}><Trash2 className="size-4" /></Button>}</div></header>
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Task overview"><Overview label="Status"><SelectControl className="w-full" aria-label="Update task status" value={task.status} disabled={updateStatus.isPending} onChange={(event) => updateStatus.mutate(event.target.value as TaskStatus)}>{TASK_STATUSES.map((status) => <option key={status} value={status}>{taskStatusLabel[status]}</option>)}</SelectControl></Overview><Overview label="Assignee"><EmployeeChip employee={assignee} /></Overview><Overview label="Due date"><span className="inline-flex items-center gap-2 text-sm"><CalendarDays className="size-4 text-muted-foreground" />{formatDate(task.due_date)}</span></Overview><Overview label="Progress"><ProgressBar value={task.progress} /></Overview></section>
    <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(19rem,.65fr)]"><div className="min-w-0 space-y-6"><Card><CardHeader><CardTitle>Comments</CardTitle><p className="text-sm text-muted-foreground">Discussion for this task</p></CardHeader><CardContent><form className="mb-5 space-y-2 rounded-xl border bg-background p-3" onSubmit={commentForm.handleSubmit((values) => commentMutation.mutate(values))} noValidate><Label htmlFor="task-comment">Add a comment</Label><Textarea id="task-comment" className="min-h-20" placeholder="Share an update, question, or decision…" {...commentForm.register("body")} />{commentForm.formState.errors.body && <p role="alert" className="text-xs text-destructive">{commentForm.formState.errors.body.message}</p>}<div className="flex justify-end"><Button size="sm" disabled={commentMutation.isPending}>{commentMutation.isPending && <LoaderCircle className="size-3.5 animate-spin" />}Comment</Button></div></form>{task.comments.length ? <ol className="space-y-4">{task.comments.map((comment) => { const author = employees.find((employee) => employee.id === comment.author_id); return <li key={comment.id} className="flex gap-3"><EmployeeChip employee={author} compact /><div className="min-w-0 flex-1 rounded-xl rounded-tl-sm bg-muted p-3"><div className="flex flex-wrap items-baseline justify-between gap-2"><p className="text-sm font-medium">{author ? `${author.first_name} ${author.last_name}` : "Former workspace member"}</p><time className="text-xs text-muted-foreground">{relativeDate(comment.created_at)}</time></div><p className="mt-2 whitespace-pre-wrap text-sm leading-5">{comment.body}</p></div></li>; })}</ol> : <div className="rounded-lg border border-dashed p-5 text-center"><MessageSquare className="mx-auto mb-2 size-5 text-muted-foreground" /><p className="text-sm text-muted-foreground">No comments yet. Start the discussion above.</p></div>}</CardContent></Card>
      <Card><CardHeader className="flex-row items-center justify-between"><div><CardTitle>Task notes</CardTitle><p className="mt-1 text-sm text-muted-foreground">Context linked directly to this task</p></div><Button variant="outline" size="sm" onClick={() => setNoteOpen(true)}><Plus className="size-3.5" />Note</Button></CardHeader><CardContent>{notesQuery.isLoading ? <RowsSkeleton /> : notesQuery.isError ? <ErrorState title="Notes could not be loaded" retry={() => void notesQuery.refetch()} /> : notesQuery.data?.items.length ? <div className="grid gap-3 sm:grid-cols-2">{notesQuery.data.items.map((note) => <Link key={note.id} href={`/notes/${note.id}`} className="rounded-lg border bg-background p-4 outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"><FileText className="mb-2 size-4 text-primary" /><h3 className="font-medium">{note.title}</h3><p className="mt-2 line-clamp-4 whitespace-pre-wrap text-sm text-muted-foreground">{note.body}</p></Link>)}</div> : <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">No task notes are available.</p>}</CardContent></Card></div>
      <aside className="min-w-0 space-y-6"><Card><CardHeader><CardTitle>Task details</CardTitle></CardHeader><CardContent><dl className="space-y-4 text-sm"><Detail label="Project" value={project ? <Link href={`/projects/${project.id}`} className="text-primary hover:underline">{project.name}</Link> : "Loading…"} /><Detail label="Assigned to" value={<EmployeeChip employee={assignee} />} /><Detail label="Priority" value={<PriorityBadge priority={task.priority} />} /><Detail label="Created" value={new Date(task.created_at).toLocaleDateString()} /><Detail label="Due" value={formatDate(task.due_date)} /></dl>{task.tags.length > 0 && <div className="mt-5 border-t pt-4"><p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Tags</p><TagPills tags={task.tags} /></div>}</CardContent></Card><Card><CardHeader><CardTitle>Activity history</CardTitle><p className="text-sm text-muted-foreground">Immutable changes recorded by the backend</p></CardHeader><CardContent><ActivityFeed items={activityQuery.data?.items} employees={employees} loading={activityQuery.isLoading} unavailable={activityUnavailable} /></CardContent></Card></aside></div>
    <TaskFormDialog open={editOpen} onOpenChange={setEditOpen} task={task} projects={project ? [project] : []} employees={employees} tags={tagsQuery.data?.items ?? []} role={user?.role ?? "employee"} />
    <NoteFormDialog open={noteOpen} onOpenChange={setNoteOpen} taskId={taskId} />
    <ConfirmDialog open={deleteOpen} onOpenChange={setDeleteOpen} title="Delete this task?" description="The task will leave active project and task views. Its comments and audit history remain retained with the soft-deleted record." pending={removeMutation.isPending} onConfirm={() => removeMutation.mutate()} />
  </div>;
}

function Overview({ label, children }: { label: string; children: React.ReactNode }) { return <Card><CardContent className="p-4"><p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>{children}</CardContent></Card>; }
function Detail({ label, value }: { label: string; value: React.ReactNode }) { return <div className="flex items-start justify-between gap-4"><dt className="text-muted-foreground">{label}</dt><dd className="min-w-0 text-right">{value}</dd></div>; }
function RowsSkeleton() { return <div className="space-y-3" role="status"><Skeleton className="h-16" /><Skeleton className="h-16" /></div>; }
function TaskDetailsSkeleton() { return <div className="space-y-6" role="status" aria-label="Loading task"><Skeleton className="h-5 w-28" /><Skeleton className="h-32" /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-24" />)}</div><div className="grid gap-6 xl:grid-cols-[1.35fr_.65fr]"><Skeleton className="h-[30rem]" /><Skeleton className="h-[30rem]" /></div></div>; }
