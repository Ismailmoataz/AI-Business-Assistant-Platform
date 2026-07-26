"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CalendarDays, CheckSquare2, Clock3, FileText, Pencil, Plus, Tag as TagIcon, Trash2, UserRound } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { NoteFormDialog } from "@/components/business/note-form-dialog";
import { ProjectFormDialog } from "@/components/business/project-form-dialog";
import { ActivityFeed, ConfirmDialog, EmployeeChip, PriorityBadge, ProgressBar, ProjectStatusBadge, TagPills, TaskStatusBadge, formatDate, relativeDate } from "@/components/business/shared";
import { TaskFormDialog } from "@/components/business/task-form-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiRequestError } from "@/lib/api/client";
import { businessApi, businessKeys } from "@/lib/api/business";
import { useProtectedRoute } from "@/hooks/use-protected-route";
import type { Employee, Task } from "@/lib/types/business";

export function ProjectDetails() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;
  const router = useRouter();
  const queryClient = useQueryClient();
  const { ready, user } = useProtectedRoute();
  const [editOpen, setEditOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const projectQuery = useQuery({ queryKey: businessKeys.project(projectId), queryFn: () => businessApi.projects.get(projectId), enabled: ready && Boolean(projectId) });
  const tasksQuery = useQuery({ queryKey: [...businessKeys.tasks, "project", projectId], queryFn: () => businessApi.tasks.list({ projectId }, 0, 100), enabled: ready && Boolean(projectId) });
  const employeesQuery = useQuery({ queryKey: businessKeys.employees, queryFn: () => businessApi.employees.list(), enabled: ready });
  const tagsQuery = useQuery({ queryKey: businessKeys.tags, queryFn: () => businessApi.tags.list(), enabled: ready });
  const notesQuery = useQuery({ queryKey: [...businessKeys.notes, projectId], queryFn: () => businessApi.notes.list(projectId), enabled: ready && Boolean(projectId) });
  const activityQuery = useQuery({ queryKey: [...businessKeys.activity, "project", projectId], queryFn: () => businessApi.activity.list("project", projectId), enabled: ready && Boolean(projectId), retry: false });
  const removeMutation = useMutation({ mutationFn: () => businessApi.projects.remove(projectId), onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: businessKeys.projects }); toast.success("Project deleted"); router.replace("/projects"); }, onError: (error) => toast.error(error instanceof Error ? error.message : "Project could not be deleted") });

  const project = projectQuery.data;
  const tasks = useMemo(() => tasksQuery.data?.items ?? [], [tasksQuery.data?.items]);
  const employees = useMemo(() => employeesQuery.data?.items ?? [], [employeesQuery.data?.items]);
  const tags = tagsQuery.data?.items ?? [];
  const owner = employees.find((employee) => employee.id === project?.owner_id);
  const team = useMemo(() => projectTeam(owner, tasks, employees), [employees, owner, tasks]);
  const progress = tasks.length ? tasks.reduce((sum, task) => sum + task.progress, 0) / tasks.length : 0;
  const canManage = user?.role !== "employee";
  const activityUnavailable = activityQuery.error instanceof ApiRequestError && activityQuery.error.status === 403;

  if (!ready || projectQuery.isLoading) return <ProjectDetailsSkeleton />;
  if (projectQuery.isError || !project) return <ErrorState title="Project unavailable" description="It may have been deleted, or it may be outside your access scope." retry={() => void projectQuery.refetch()} />;
  return <div className="min-w-0 space-y-6">
    <Link href="/projects" className="inline-flex items-center gap-2 rounded-md text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"><ArrowLeft className="size-4" />Back to projects</Link>
    <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><ProjectStatusBadge status={project.status} /><span className="text-xs text-muted-foreground">Updated {relativeDate(project.updated_at)}</span></div><h1 className="mt-3 break-words text-2xl font-semibold tracking-[-.03em] sm:text-3xl">{project.name}</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{project.description || "No project description has been added yet."}</p></div><div className="flex flex-wrap gap-2">{canManage && <><Button variant="outline" onClick={() => setEditOpen(true)}><Pencil className="size-4" />Edit</Button><Button onClick={() => setTaskOpen(true)}><Plus className="size-4" />Add task</Button><Button variant="ghost" size="icon" className="text-destructive" aria-label="Delete project" onClick={() => setDeleteOpen(true)}><Trash2 className="size-4" /></Button></>}</div></header>
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Project overview"><Metric icon={CheckSquare2} label="Progress"><ProgressBar value={progress} /></Metric><Metric icon={UserRound} label="Owner"><EmployeeChip employee={owner} /></Metric><Metric icon={CalendarDays} label="Timeline"><span className="text-sm">{formatDate(project.start_date)} – {formatDate(project.end_date)}</span></Metric><Metric icon={TagIcon} label="Tags"><TagPills tags={project.tags} /><span className="text-sm text-muted-foreground">{project.tags.length ? "" : "No tags"}</span></Metric></section>
    <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(19rem,.6fr)]">
      <div className="min-w-0 space-y-6"><Card><CardHeader className="flex-row items-center justify-between"><div><CardTitle>Linked tasks</CardTitle><p className="mt-1 text-sm text-muted-foreground">{tasksQuery.data?.page.total ?? 0} work items in this project</p></div>{canManage && <Button variant="outline" size="sm" onClick={() => setTaskOpen(true)}><Plus className="size-3.5" />Task</Button>}</CardHeader><CardContent>{tasksQuery.isLoading ? <TaskRowsSkeleton /> : tasksQuery.isError ? <ErrorState title="Tasks could not be loaded" retry={() => void tasksQuery.refetch()} /> : tasks.length ? <div className="divide-y">{tasks.map((task) => <LinkedTask key={task.id} task={task} assignee={employees.find((employee) => employee.id === task.assignee_id)} />)}</div> : <EmptyState icon={CheckSquare2} title="No linked tasks" description={canManage ? "Add the first task to turn this project into actionable work." : "No tasks are assigned in this project yet."} action={canManage ? { label: "Add task", onClick: () => setTaskOpen(true) } : undefined} />}</CardContent></Card>
      <Card><CardHeader className="flex-row items-center justify-between"><div><CardTitle>Notes</CardTitle><p className="mt-1 text-sm text-muted-foreground">Shared project context</p></div><Button variant="outline" size="sm" onClick={() => setNoteOpen(true)}><Plus className="size-3.5" />Note</Button></CardHeader><CardContent>{notesQuery.isLoading ? <TaskRowsSkeleton /> : notesQuery.isError ? <ErrorState title="Notes could not be loaded" retry={() => void notesQuery.refetch()} /> : notesQuery.data?.items.length ? <div className="grid gap-3 sm:grid-cols-2">{notesQuery.data.items.map((note) => <article key={note.id} className="rounded-lg border bg-background p-4"><div className="flex items-start gap-2"><FileText className="mt-0.5 size-4 shrink-0 text-primary" /><div className="min-w-0"><h3 className="font-medium">{note.title}</h3><p className="mt-2 line-clamp-4 whitespace-pre-wrap text-sm leading-5 text-muted-foreground">{note.body}</p><p className="mt-3 text-xs text-muted-foreground">Updated {relativeDate(note.updated_at)}</p></div></div></article>)}</div> : <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">No notes have been added to this project.</p>}</CardContent></Card></div>
      <aside className="min-w-0 space-y-6"><Card><CardHeader><CardTitle>Project team</CardTitle><p className="text-sm text-muted-foreground">Owner and assigned teammates</p></CardHeader><CardContent>{team.length ? <ul className="space-y-3">{team.map((employee) => <li key={employee.id} className="flex items-center gap-3"><EmployeeChip employee={employee} /><span className="ml-auto text-xs text-muted-foreground">{employee.id === project.owner_id ? "Owner" : employee.job_title ?? "Member"}</span></li>)}</ul> : <p className="text-sm text-muted-foreground">No teammates are assigned.</p>}</CardContent></Card><Card><CardHeader><CardTitle>Recent activity</CardTitle><p className="text-sm text-muted-foreground">Project changes from the backend audit trail</p></CardHeader><CardContent><ActivityFeed items={activityQuery.data?.items} employees={employees} loading={activityQuery.isLoading} unavailable={activityUnavailable} /></CardContent></Card></aside>
    </div>
    <ProjectFormDialog open={editOpen} onOpenChange={setEditOpen} project={project} employees={employees} tags={tags} />
    <TaskFormDialog open={taskOpen} onOpenChange={setTaskOpen} defaultProjectId={project.id} projects={[project]} employees={employees} tags={tags} role={user?.role ?? "employee"} />
    <NoteFormDialog open={noteOpen} onOpenChange={setNoteOpen} projectId={project.id} />
    <ConfirmDialog open={deleteOpen} onOpenChange={setDeleteOpen} title="Delete this project?" description="The project will be removed from active views together with access to its linked tasks. Its audit history is retained." pending={removeMutation.isPending} onConfirm={() => removeMutation.mutate()} />
  </div>;
}

function Metric({ icon: Icon, label, children }: { icon: typeof Clock3; label: string; children: React.ReactNode }) { return <Card><CardContent className="p-4"><div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground"><Icon className="size-3.5" />{label}</div>{children}</CardContent></Card>; }
function LinkedTask({ task, assignee }: { task: Task; assignee?: Employee }) { return <Link href={`/tasks/${task.id}`} className="flex flex-col gap-3 rounded-lg px-2 py-4 outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="truncate font-medium">{task.title}</h3><TaskStatusBadge status={task.status} /><PriorityBadge priority={task.priority} /></div><div className="mt-2"><TagPills tags={task.tags} limit={3} /></div></div><div className="flex shrink-0 items-center gap-3"><EmployeeChip employee={assignee} compact /><span className="text-xs text-muted-foreground">{formatDate(task.due_date)}</span><div className="w-24"><ProgressBar value={task.progress} label={false} /></div></div></Link>; }
function projectTeam(owner: Employee | undefined, tasks: Task[], employees: Employee[]) { const ids = new Set(tasks.map((task) => task.assignee_id).filter((id): id is string => Boolean(id))); if (owner) ids.add(owner.id); return [...ids].map((id) => employees.find((employee) => employee.id === id)).filter((employee): employee is Employee => Boolean(employee)); }
function TaskRowsSkeleton() { return <div className="space-y-3" role="status"><Skeleton className="h-16" /><Skeleton className="h-16" /><Skeleton className="h-16" /></div>; }
function ProjectDetailsSkeleton() { return <div className="space-y-6" role="status" aria-label="Loading project"><Skeleton className="h-5 w-32" /><Skeleton className="h-32 w-full" /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-24" />)}</div><div className="grid gap-6 xl:grid-cols-[1.4fr_.6fr]"><Skeleton className="h-96" /><Skeleton className="h-96" /></div></div>; }
