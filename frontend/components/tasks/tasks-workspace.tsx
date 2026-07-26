"use client";

import * as Dropdown from "@radix-ui/react-dropdown-menu";
import { useEffect, useMemo, useState } from "react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Columns3, LayoutList, LoaderCircle, MoreHorizontal, Pencil, Plus, Rows3, Table2, X } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { EmployeeChip, PriorityBadge, ProgressBar, SelectControl, TASK_PRIORITIES, TASK_STATUSES, TagPills, TaskStatusBadge, formatDate, priorityLabel, taskStatusLabel } from "@/components/business/shared";
import { TaskFormDialog } from "@/components/business/task-form-dialog";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { SearchInput } from "@/components/ui/search-input";
import { Skeleton } from "@/components/ui/skeleton";
import { businessApi, businessKeys } from "@/lib/api/business";
import { useProtectedRoute } from "@/hooks/use-protected-route";
import type { Employee, Project, Task, TaskFilters, TaskSort, TaskStatus } from "@/lib/types/business";
import { cn } from "@/lib/utils";

type TaskView = "list" | "kanban" | "table";
type BoardColumn = "todo" | "in_progress" | "review" | "done";
const BOARD_COLUMNS: Array<{ id: BoardColumn; label: string; description: string }> = [
  { id: "todo", label: "Todo", description: "Ready to start" },
  { id: "in_progress", label: "In progress", description: "Work underway" },
  { id: "review", label: "Review", description: "Awaiting review" },
  { id: "done", label: "Completed", description: "Finished work" },
];

export function TasksWorkspace() {
  const { ready, user } = useProtectedRoute();
  const queryClient = useQueryClient();
  const [view, setView] = useState<TaskView>("kanban");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState<TaskFilters["status"]>("all");
  const [priority, setPriority] = useState<TaskFilters["priority"]>("all");
  const [assigneeId, setAssigneeId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [tagId, setTagId] = useState("");
  const [sort, setSort] = useState<TaskSort>("due_date");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [pendingStatuses, setPendingStatuses] = useState<Record<string, TaskStatus>>({});

  useEffect(() => { const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300); return () => window.clearTimeout(timer); }, [search]);
  const filters = useMemo<TaskFilters>(() => ({ search: debouncedSearch, status, priority, assigneeId, projectId, tagId, sort }), [assigneeId, debouncedSearch, priority, projectId, sort, status, tagId]);
  const tasksQuery = useInfiniteQuery({
    queryKey: [...businessKeys.tasks, "workspace", filters],
    queryFn: ({ pageParam }) => businessApi.tasks.list(filters, pageParam, 100),
    initialPageParam: 0,
    enabled: ready,
    getNextPageParam: (lastPage) => { const next = lastPage.page.offset + lastPage.items.length; return next < lastPage.page.total ? next : undefined; },
  });
  const projectsQuery = useQuery({ queryKey: [...businessKeys.projects, "options"], queryFn: () => businessApi.projects.list({}, 0, 100), enabled: ready });
  const employeesQuery = useQuery({ queryKey: businessKeys.employees, queryFn: () => businessApi.employees.list(), enabled: ready });
  const tagsQuery = useQuery({ queryKey: businessKeys.tags, queryFn: () => businessApi.tags.list(), enabled: ready });
  const projects = projectsQuery.data?.items ?? [];
  const employees = employeesQuery.data?.items ?? [];
  const tags = tagsQuery.data?.items ?? [];
  const rawTasks = useMemo(() => tasksQuery.data?.pages.flatMap((page) => page.items) ?? [], [tasksQuery.data]);
  const tasks = useMemo(() => rawTasks.map((task) => pendingStatuses[task.id] ? { ...task, status: pendingStatuses[task.id] } : task), [pendingStatuses, rawTasks]);
  const total = tasksQuery.data?.pages[0]?.page.total ?? 0;
  const filtersActive = status !== "all" || priority !== "all" || assigneeId || projectId || tagId;
  const canManage = user?.role !== "employee";

  const statusMutation = useMutation({
    mutationFn: ({ taskId, nextStatus }: { taskId: string; nextStatus: TaskStatus }) => businessApi.tasks.update(taskId, { status: nextStatus, progress: nextStatus === "done" ? 100 : undefined }),
    onMutate: ({ taskId, nextStatus }) => setPendingStatuses((current) => ({ ...current, [taskId]: nextStatus })),
    onSuccess: () => toast.success("Task status updated"),
    onError: (error, variables) => { setPendingStatuses((current) => { const next = { ...current }; delete next[variables.taskId]; return next; }); toast.error(error instanceof Error ? error.message : "Status could not be updated"); },
    onSettled: async (_data, _error, variables) => { await queryClient.invalidateQueries({ queryKey: businessKeys.tasks }); setPendingStatuses((current) => { const next = { ...current }; delete next[variables.taskId]; return next; }); },
  });
  const moveTask = (taskId: string, nextStatus: TaskStatus) => { const task = tasks.find((item) => item.id === taskId); if (!task || task.status === nextStatus || statusMutation.isPending) return; statusMutation.mutate({ taskId, nextStatus }); };

  if (!ready) return <TasksSkeleton />;
  return <div className="min-w-0 space-y-5">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="text-2xl font-semibold tracking-[-.03em] sm:text-3xl">Tasks</h1><p className="mt-1 text-sm text-muted-foreground">Move work from intent to done across every project.</p></div>{canManage && <Button onClick={() => { setEditing(null); setFormOpen(true); }} disabled={!projects.length}><Plus className="size-4" />New task</Button>}</header>
    <section aria-label="Task search and filters" className="space-y-3 rounded-xl border bg-card p-3 shadow-card"><div className="flex flex-col gap-2 lg:flex-row"><SearchInput value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search tasks and descriptions…" aria-label="Search tasks" className="min-w-0 flex-1" /><div className="flex flex-wrap gap-2"><SelectControl aria-label="Filter by status" value={status} onChange={(event) => setStatus(event.target.value as TaskFilters["status"])}><option value="all">All statuses</option>{TASK_STATUSES.map((item) => <option key={item} value={item}>{taskStatusLabel[item]}</option>)}</SelectControl><SelectControl aria-label="Filter by priority" value={priority} onChange={(event) => setPriority(event.target.value as TaskFilters["priority"])}><option value="all">All priorities</option>{TASK_PRIORITIES.map((item) => <option key={item} value={item}>{priorityLabel[item]}</option>)}</SelectControl><SelectControl aria-label="Filter by assignee" value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)}><option value="">All assignees</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.first_name} {employee.last_name}</option>)}</SelectControl><SelectControl aria-label="Filter by project" value={projectId} onChange={(event) => setProjectId(event.target.value)}><option value="">All projects</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</SelectControl><SelectControl aria-label="Filter by tag" value={tagId} onChange={(event) => setTagId(event.target.value)}><option value="">All tags</option>{tags.map((tag) => <option key={tag.id} value={tag.id}>{tag.name}</option>)}</SelectControl></div></div><div className="flex flex-wrap items-center gap-2"><SelectControl aria-label="Sort tasks" value={sort} onChange={(event) => setSort(event.target.value as TaskSort)}><option value="due_date">Due date</option><option value="name">Name</option><option value="priority">Priority</option><option value="updated">Recently updated</option></SelectControl>{filtersActive && <Button variant="ghost" size="sm" onClick={() => { setStatus("all"); setPriority("all"); setAssigneeId(""); setProjectId(""); setTagId(""); }}><X className="size-3.5" />Clear filters</Button>}<span className="ml-auto text-xs text-muted-foreground">{total} tasks</span><ViewSwitcher view={view} onChange={setView} /></div></section>
    {tasksQuery.isLoading ? <TasksSkeleton compact /> : tasksQuery.isError ? <ErrorState title="Tasks could not be loaded" retry={() => void tasksQuery.refetch()} /> : !tasks.length ? <EmptyState icon={Rows3} title={debouncedSearch || filtersActive ? "No matching tasks" : "No tasks yet"} description={debouncedSearch || filtersActive ? "Try a different search or clear the active filters." : canManage ? "Create the first task to start moving project work forward." : "No tasks are currently assigned to you."} action={canManage && projects.length && !debouncedSearch && !filtersActive ? { label: "Create task", onClick: () => setFormOpen(true) } : undefined} /> : view === "kanban" ? <KanbanBoard tasks={tasks} projects={projects} employees={employees} draggedId={draggedId} onDragStart={setDraggedId} onDragEnd={() => setDraggedId(null)} onDrop={(column) => { if (draggedId) moveTask(draggedId, column); setDraggedId(null); }} onStatus={moveTask} onEdit={(task) => { setEditing(task); setFormOpen(true); }} /> : view === "list" ? <TaskList tasks={tasks} projects={projects} employees={employees} onStatus={moveTask} onEdit={(task) => { setEditing(task); setFormOpen(true); }} /> : <TaskTable tasks={tasks} projects={projects} employees={employees} onStatus={moveTask} onEdit={(task) => { setEditing(task); setFormOpen(true); }} />}
    {tasksQuery.hasNextPage && <div className="flex justify-center"><Button variant="outline" disabled={tasksQuery.isFetchingNextPage} onClick={() => void tasksQuery.fetchNextPage()}>{tasksQuery.isFetchingNextPage && <LoaderCircle className="size-4 animate-spin" />}Load more tasks</Button></div>}
    <TaskFormDialog open={formOpen} onOpenChange={setFormOpen} task={editing} defaultProjectId={projectId || undefined} projects={projects} employees={employees} tags={tags} role={user?.role ?? "employee"} />
    <p className="sr-only" aria-live="polite">{statusMutation.isPending ? "Updating task status" : ""}</p>
  </div>;
}

function ViewSwitcher({ view, onChange }: { view: TaskView; onChange: (view: TaskView) => void }) { return <div className="flex rounded-lg border bg-background p-0.5" role="group" aria-label="Task view"><Button variant={view === "list" ? "secondary" : "ghost"} size="icon" className="size-8" aria-label="Task list view" onClick={() => onChange("list")}><LayoutList className="size-4" /></Button><Button variant={view === "kanban" ? "secondary" : "ghost"} size="icon" className="size-8" aria-label="Kanban board view" onClick={() => onChange("kanban")}><Columns3 className="size-4" /></Button><Button variant={view === "table" ? "secondary" : "ghost"} size="icon" className="size-8" aria-label="Task table view" onClick={() => onChange("table")}><Table2 className="size-4" /></Button></div>; }

function KanbanBoard({ tasks, projects, employees, draggedId, onDragStart, onDragEnd, onDrop, onStatus, onEdit }: { tasks: Task[]; projects: Project[]; employees: Employee[]; draggedId: string | null; onDragStart: (id: string) => void; onDragEnd: () => void; onDrop: (status: BoardColumn) => void; onStatus: (id: string, status: TaskStatus) => void; onEdit: (task: Task) => void }) {
  return <section className="grid min-w-0 gap-4 lg:grid-cols-2 2xl:grid-cols-4" aria-label="Task Kanban board">{BOARD_COLUMNS.map((column) => { const columnTasks = tasks.filter((task) => boardColumn(task.status) === column.id); return <div key={column.id} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); onDrop(column.id); }} className={cn("min-w-0 rounded-xl border bg-muted/35 p-3 transition", draggedId && "border-dashed border-primary/50")}><header className="mb-3 flex items-center gap-2 px-1"><span className={cn("size-2 rounded-full", column.id === "done" ? "bg-success" : column.id === "review" ? "bg-primary" : column.id === "in_progress" ? "bg-warning" : "bg-muted-foreground")} /><div className="min-w-0 flex-1"><h2 className="text-sm font-semibold">{column.label}</h2><p className="text-[11px] text-muted-foreground">{column.description}</p></div><span className="rounded-full bg-card px-2 py-0.5 text-xs tabular-nums">{columnTasks.length}</span></header><div className="space-y-3">{columnTasks.map((task) => <KanbanCard key={task.id} task={task} project={projects.find((project) => project.id === task.project_id)} assignee={employees.find((employee) => employee.id === task.assignee_id)} dragging={draggedId === task.id} onDragStart={() => onDragStart(task.id)} onDragEnd={onDragEnd} onStatus={onStatus} onEdit={() => onEdit(task)} />)}{!columnTasks.length && <div className="grid min-h-24 place-items-center rounded-lg border border-dashed bg-background/45 p-4 text-center text-xs text-muted-foreground">Drop a task here</div>}</div></div>; })}</section>;
}

function KanbanCard({ task, project, assignee, dragging, onDragStart, onDragEnd, onStatus, onEdit }: { task: Task; project?: Project; assignee?: Employee; dragging: boolean; onDragStart: () => void; onDragEnd: () => void; onStatus: (id: string, status: TaskStatus) => void; onEdit: () => void }) {
  return <article draggable onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", task.id); onDragStart(); }} onDragEnd={onDragEnd} className={cn("min-w-0 cursor-grab rounded-xl border bg-card p-4 shadow-card outline-none transition active:cursor-grabbing", dragging && "opacity-45")}><div className="flex items-start gap-2"><PriorityBadge priority={task.priority} /><TaskActions task={task} onEdit={onEdit} className="ml-auto" /></div><Link href={`/tasks/${task.id}`} className="mt-3 block rounded-sm font-medium leading-5 outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring">{task.title}</Link><p className="mt-1 truncate text-xs text-muted-foreground">{project?.name ?? "Unknown project"}</p><div className="mt-3"><TagPills tags={task.tags} limit={2} /></div><div className="mt-4 flex items-center justify-between gap-2"><EmployeeChip employee={assignee} compact /><span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><CalendarDays className="size-3" />{formatDate(task.due_date, "No date")}</span></div><div className="mt-3"><ProgressBar value={task.progress} /></div><select value={task.status} onChange={(event) => onStatus(task.id, event.target.value as TaskStatus)} className="mt-3 h-8 w-full rounded-md border bg-background px-2 text-xs outline-none focus:ring-2 focus:ring-ring" aria-label={`Move ${task.title} to another status`}>{TASK_STATUSES.map((status) => <option key={status} value={status}>{taskStatusLabel[status]}</option>)}</select></article>;
}

function TaskList({ tasks, projects, employees, onStatus, onEdit }: { tasks: Task[]; projects: Project[]; employees: Employee[]; onStatus: (id: string, status: TaskStatus) => void; onEdit: (task: Task) => void }) { return <div className="space-y-3">{tasks.map((task) => <article key={task.id} className="min-w-0 rounded-xl border bg-card p-4 shadow-card"><div className="flex flex-col gap-4 lg:flex-row lg:items-center"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><TaskStatusBadge status={task.status} /><PriorityBadge priority={task.priority} /></div><Link href={`/tasks/${task.id}`} className="mt-2 block truncate rounded-sm font-semibold outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring">{task.title}</Link><p className="mt-1 truncate text-xs text-muted-foreground">{projects.find((project) => project.id === task.project_id)?.name ?? "Unknown project"}</p><div className="mt-2"><TagPills tags={task.tags} limit={4} /></div></div><div className="grid shrink-0 grid-cols-2 items-center gap-3 sm:grid-cols-4 lg:flex"><EmployeeChip employee={employees.find((employee) => employee.id === task.assignee_id)} compact /><span className="text-xs text-muted-foreground">{formatDate(task.due_date)}</span><div className="w-28"><ProgressBar value={task.progress} /></div><select value={task.status} onChange={(event) => onStatus(task.id, event.target.value as TaskStatus)} className="h-8 rounded-md border bg-background px-2 text-xs" aria-label={`Change status for ${task.title}`}>{TASK_STATUSES.map((item) => <option key={item} value={item}>{taskStatusLabel[item]}</option>)}</select></div><TaskActions task={task} onEdit={() => onEdit(task)} /></div></article>)}</div>; }

function TaskTable({ tasks, projects, employees, onStatus, onEdit }: { tasks: Task[]; projects: Project[]; employees: Employee[]; onStatus: (id: string, status: TaskStatus) => void; onEdit: (task: Task) => void }) { return <><div className="md:hidden"><TaskList tasks={tasks} projects={projects} employees={employees} onStatus={onStatus} onEdit={onEdit} /></div><div className="hidden overflow-hidden rounded-xl border bg-card shadow-card md:block"><div className="overflow-x-auto"><table className="w-full min-w-[980px] text-left text-sm"><thead className="border-b bg-muted/45 text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-4 py-3 font-medium">Task</th><th className="px-3 py-3 font-medium">Status</th><th className="px-3 py-3 font-medium">Priority</th><th className="px-3 py-3 font-medium">Assignee</th><th className="px-3 py-3 font-medium">Due date</th><th className="px-3 py-3 font-medium">Project</th><th className="px-3 py-3 font-medium">Progress</th><th className="w-12"><span className="sr-only">Actions</span></th></tr></thead><tbody>{tasks.map((task) => <tr key={task.id} className="border-b last:border-0 hover:bg-muted/40"><td className="px-4 py-4"><Link href={`/tasks/${task.id}`} className="font-medium hover:text-primary hover:underline">{task.title}</Link><div className="mt-1"><TagPills tags={task.tags} limit={2} /></div></td><td className="px-3 py-4"><select value={task.status} onChange={(event) => onStatus(task.id, event.target.value as TaskStatus)} className="h-8 rounded-md border bg-background px-2 text-xs" aria-label={`Change status for ${task.title}`}>{TASK_STATUSES.map((item) => <option key={item} value={item}>{taskStatusLabel[item]}</option>)}</select></td><td className="px-3 py-4"><PriorityBadge priority={task.priority} /></td><td className="px-3 py-4"><EmployeeChip employee={employees.find((employee) => employee.id === task.assignee_id)} /></td><td className="px-3 py-4 text-muted-foreground">{formatDate(task.due_date)}</td><td className="max-w-48 truncate px-3 py-4">{projects.find((project) => project.id === task.project_id)?.name ?? "Unknown"}</td><td className="w-44 px-3 py-4"><ProgressBar value={task.progress} /></td><td><TaskActions task={task} onEdit={() => onEdit(task)} /></td></tr>)}</tbody></table></div></div></>;
}

function TaskActions({ task, onEdit, className }: { task: Task; onEdit: () => void; className?: string }) { return <Dropdown.Root><Dropdown.Trigger asChild><Button variant="ghost" size="icon" className={cn("size-8", className)} aria-label={`Actions for ${task.title}`}><MoreHorizontal className="size-4" /></Button></Dropdown.Trigger><Dropdown.Portal><Dropdown.Content align="end" className="z-50 min-w-40 rounded-lg border bg-card p-1 shadow-xl"><Dropdown.Item onSelect={onEdit} className="flex cursor-default items-center gap-2 rounded-md px-2 py-2 text-sm outline-none focus:bg-muted"><Pencil className="size-4" />Edit task</Dropdown.Item></Dropdown.Content></Dropdown.Portal></Dropdown.Root>; }
function boardColumn(status: TaskStatus): BoardColumn { return status === "blocked" ? "review" : status; }
function TasksSkeleton({ compact = false }: { compact?: boolean }) { return <div className="space-y-5" role="status" aria-label="Loading tasks">{!compact && <><Skeleton className="h-10 w-44" /><Skeleton className="h-28 w-full" /></>}<div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-4">{Array.from({ length: 8 }, (_, index) => <Skeleton key={index} className="h-52 rounded-xl" />)}</div></div>; }
