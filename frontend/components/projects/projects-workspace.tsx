"use client";

import * as Dropdown from "@radix-ui/react-dropdown-menu";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Grid2X2, LayoutList, MoreHorizontal, Pencil, Plus, Rows3, X } from "lucide-react";
import Link from "next/link";
import { ProjectFormDialog } from "@/components/business/project-form-dialog";
import { EmployeeChip, ProgressBar, PROJECT_STATUSES, ProjectStatusBadge, SelectControl, TagPills, formatDate, projectStatusLabel } from "@/components/business/shared";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
import { Skeleton } from "@/components/ui/skeleton";
import { businessApi, businessKeys } from "@/lib/api/business";
import { useProtectedRoute } from "@/hooks/use-protected-route";
import type { Employee, Project, ProjectFilters, ProjectSort, Task } from "@/lib/types/business";

const PAGE_SIZE = 12;
type ProjectView = "grid" | "table";

export function ProjectsWorkspace() {
  const { ready, user } = useProtectedRoute();
  const [view, setView] = useState<ProjectView>("grid");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState<ProjectFilters["status"]>("all");
  const [ownerId, setOwnerId] = useState("");
  const [tagId, setTagId] = useState("");
  const [sort, setSort] = useState<ProjectSort>("updated");
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);

  useEffect(() => { const timer = window.setTimeout(() => { setDebouncedSearch(search.trim()); setPage(1); }, 300); return () => window.clearTimeout(timer); }, [search]);
  const filters = useMemo<ProjectFilters>(() => ({ search: debouncedSearch, status, ownerId, tagId, sort }), [debouncedSearch, ownerId, sort, status, tagId]);
  const projectsQuery = useQuery({ queryKey: [...businessKeys.projects, "page", filters, page], queryFn: () => businessApi.projects.list(filters, (page - 1) * PAGE_SIZE, PAGE_SIZE), enabled: ready });
  const employeesQuery = useQuery({ queryKey: businessKeys.employees, queryFn: () => businessApi.employees.list(), enabled: ready });
  const tagsQuery = useQuery({ queryKey: businessKeys.tags, queryFn: () => businessApi.tags.list(), enabled: ready });
  const tasksQuery = useQuery({ queryKey: [...businessKeys.tasks, "project-progress"], queryFn: () => businessApi.tasks.list({}, 0, 100), enabled: ready });

  const employees = employeesQuery.data?.items ?? [];
  const tags = tagsQuery.data?.items ?? [];
  const tasksByProject = useMemo(() => groupTasks(tasksQuery.data?.items ?? []), [tasksQuery.data?.items]);
  const projects = projectsQuery.data?.items ?? [];
  const pages = Math.max(1, Math.ceil((projectsQuery.data?.page.total ?? 0) / PAGE_SIZE));
  const filtersActive = status !== "all" || ownerId || tagId;
  const canManage = user?.role !== "employee";

  if (!ready) return <ProjectsSkeleton />;
  return <div className="min-w-0 space-y-5">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="text-2xl font-semibold tracking-[-.03em] sm:text-3xl">Projects</h1><p className="mt-1 text-sm text-muted-foreground">Plan outcomes, follow progress, and keep work connected.</p></div>{canManage && <Button onClick={() => { setEditing(null); setFormOpen(true); }}><Plus className="size-4" />New project</Button>}</header>
    <section aria-label="Project search and filters" className="space-y-3 rounded-xl border bg-card p-3 shadow-card"><div className="flex flex-col gap-2 md:flex-row"><SearchInput value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search projects and descriptions…" aria-label="Search projects" className="min-w-0 flex-1" /><div className="flex flex-wrap gap-2"><SelectControl aria-label="Filter by status" value={status} onChange={(event) => { setStatus(event.target.value as ProjectFilters["status"]); setPage(1); }}><option value="all">All statuses</option>{PROJECT_STATUSES.map((item) => <option key={item} value={item}>{projectStatusLabel[item]}</option>)}</SelectControl><SelectControl aria-label="Filter by owner" value={ownerId} onChange={(event) => { setOwnerId(event.target.value); setPage(1); }}><option value="">All owners</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.first_name} {employee.last_name}</option>)}</SelectControl><SelectControl aria-label="Filter by tag" value={tagId} onChange={(event) => { setTagId(event.target.value); setPage(1); }}><option value="">All tags</option>{tags.map((tag) => <option key={tag.id} value={tag.id}>{tag.name}</option>)}</SelectControl></div></div><div className="flex flex-wrap items-center gap-2"><SelectControl aria-label="Sort projects" value={sort} onChange={(event) => { setSort(event.target.value as ProjectSort); setPage(1); }}><option value="updated">Recently updated</option><option value="name">Name</option><option value="due_date">Due date</option></SelectControl>{filtersActive && <Button variant="ghost" size="sm" onClick={() => { setStatus("all"); setOwnerId(""); setTagId(""); setPage(1); }}><X className="size-3.5" />Clear filters</Button>}<span className="ml-auto text-xs text-muted-foreground">{projectsQuery.data?.page.total ?? 0} projects</span><div className="flex rounded-lg border bg-background p-0.5"><Button variant={view === "grid" ? "secondary" : "ghost"} size="icon" className="size-8" aria-label="Project grid view" onClick={() => setView("grid")}><Grid2X2 className="size-4" /></Button><Button variant={view === "table" ? "secondary" : "ghost"} size="icon" className="size-8" aria-label="Project table view" onClick={() => setView("table")}><LayoutList className="size-4" /></Button></div></div></section>
    {projectsQuery.isLoading ? <ProjectsSkeleton compact /> : projectsQuery.isError ? <ErrorState title="Projects could not be loaded" retry={() => void projectsQuery.refetch()} /> : !projects.length ? <EmptyState icon={Rows3} title={debouncedSearch || filtersActive ? "No matching projects" : "No projects yet"} description={debouncedSearch || filtersActive ? "Try a different search or clear the active filters." : canManage ? "Create the first project to coordinate your team’s work." : "No projects are currently visible in your assignment scope."} action={canManage && !debouncedSearch && !filtersActive ? { label: "Create project", onClick: () => setFormOpen(true) } : undefined} /> : view === "grid" ? <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-3">{projects.map((project) => <ProjectCard key={project.id} project={project} owner={employees.find((employee) => employee.id === project.owner_id)} tasks={tasksByProject.get(project.id) ?? []} canManage={canManage} onEdit={() => { setEditing(project); setFormOpen(true); }} />)}</div> : <ProjectTable projects={projects} employees={employees} tasksByProject={tasksByProject} canManage={canManage} onEdit={(project) => { setEditing(project); setFormOpen(true); }} />}
    {projectsQuery.data && pages > 1 && <Pagination page={page} pages={pages} onPageChange={setPage} />}
    <ProjectFormDialog open={formOpen} onOpenChange={setFormOpen} project={editing} employees={employees} tags={tags} />
  </div>;
}

function ProjectCard({ project, owner, tasks, canManage, onEdit }: { project: Project; owner?: Employee; tasks: Task[]; canManage: boolean; onEdit: () => void }) {
  const progress = projectProgress(tasks);
  return <article className="group min-w-0 rounded-xl border bg-card p-5 shadow-card transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg"><div className="flex items-start gap-3"><div className="min-w-0 flex-1"><ProjectStatusBadge status={project.status} /><Link href={`/projects/${project.id}`} className="mt-3 block rounded-sm text-lg font-semibold tracking-tight outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"><span className="line-clamp-1">{project.name}</span></Link></div>{canManage && <ProjectMenu name={project.name} onEdit={onEdit} />}</div><p className="mt-2 line-clamp-2 min-h-10 text-sm leading-5 text-muted-foreground">{project.description || "No description has been added yet."}</p><div className="mt-4"><div className="mb-2 flex items-center justify-between text-xs"><span className="text-muted-foreground">Progress</span><span>{tasks.length} {tasks.length === 1 ? "task" : "tasks"}</span></div><ProgressBar value={progress} /></div><div className="mt-4 min-h-6"><TagPills tags={project.tags} limit={3} /></div><div className="mt-4 flex items-center justify-between gap-3 border-t pt-4"><EmployeeChip employee={owner} /><span className="inline-flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground"><CalendarDays className="size-3.5" />{formatDate(project.end_date)}</span></div></article>;
}

function ProjectTable({ projects, employees, tasksByProject, canManage, onEdit }: { projects: Project[]; employees: Employee[]; tasksByProject: Map<string, Task[]>; canManage: boolean; onEdit: (project: Project) => void }) {
  return <><div className="space-y-3 md:hidden">{projects.map((project) => <ProjectCard key={project.id} project={project} owner={employees.find((employee) => employee.id === project.owner_id)} tasks={tasksByProject.get(project.id) ?? []} canManage={canManage} onEdit={() => onEdit(project)} />)}</div><div className="hidden overflow-hidden rounded-xl border bg-card shadow-card md:block"><div className="overflow-x-auto"><table className="w-full min-w-[840px] text-left text-sm"><thead className="border-b bg-muted/45 text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-4 py-3 font-medium">Project</th><th className="px-3 py-3 font-medium">Status</th><th className="px-3 py-3 font-medium">Owner</th><th className="px-3 py-3 font-medium">Due date</th><th className="px-3 py-3 font-medium">Progress</th><th className="w-12"><span className="sr-only">Actions</span></th></tr></thead><tbody>{projects.map((project) => <tr key={project.id} className="border-b last:border-0 hover:bg-muted/40"><td className="px-4 py-4"><Link href={`/projects/${project.id}`} className="font-medium hover:text-primary hover:underline">{project.name}</Link><div className="mt-1"><TagPills tags={project.tags} limit={2} /></div></td><td className="px-3 py-4"><ProjectStatusBadge status={project.status} /></td><td className="px-3 py-4"><EmployeeChip employee={employees.find((employee) => employee.id === project.owner_id)} /></td><td className="px-3 py-4 text-muted-foreground">{formatDate(project.end_date)}</td><td className="w-48 px-3 py-4"><ProgressBar value={projectProgress(tasksByProject.get(project.id) ?? [])} /></td><td>{canManage && <ProjectMenu name={project.name} onEdit={() => onEdit(project)} />}</td></tr>)}</tbody></table></div></div></>;
}

function ProjectMenu({ name, onEdit }: { name: string; onEdit: () => void }) { return <Dropdown.Root><Dropdown.Trigger asChild><Button variant="ghost" size="icon" className="size-8" aria-label={`Actions for ${name}`}><MoreHorizontal className="size-4" /></Button></Dropdown.Trigger><Dropdown.Portal><Dropdown.Content align="end" className="z-50 min-w-40 rounded-lg border bg-card p-1 shadow-xl"><Dropdown.Item onSelect={onEdit} className="flex cursor-default items-center gap-2 rounded-md px-2 py-2 text-sm outline-none focus:bg-muted"><Pencil className="size-4" />Edit project</Dropdown.Item></Dropdown.Content></Dropdown.Portal></Dropdown.Root>; }
function projectProgress(tasks: Task[]) { return tasks.length ? tasks.reduce((total, task) => total + task.progress, 0) / tasks.length : 0; }
function groupTasks(tasks: Task[]) { const groups = new Map<string, Task[]>(); for (const task of tasks) groups.set(task.project_id, [...(groups.get(task.project_id) ?? []), task]); return groups; }
function ProjectsSkeleton({ compact = false }: { compact?: boolean }) { return <div className="space-y-5" role="status" aria-label="Loading projects">{!compact && <><Skeleton className="h-10 w-52" /><Skeleton className="h-24 w-full" /></>}<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-72 rounded-xl" />)}</div></div>; }
