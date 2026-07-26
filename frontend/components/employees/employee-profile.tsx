"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, BriefcaseBusiness, CalendarDays, FileText, Mail, Pencil, Phone, UserRound } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { EmployeeFormDialog } from "@/components/business/employee-form-dialog";
import { NoteFormDialog } from "@/components/business/note-form-dialog";
import { ActivityFeed, EmployeeChip, EmploymentStatusBadge, PriorityBadge, ProjectStatusBadge, TaskStatusBadge, employeeName, formatDate, relativeDate } from "@/components/business/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useProtectedRoute } from "@/hooks/use-protected-route";
import { businessApi, businessKeys } from "@/lib/api/business";
import { documentsApi } from "@/lib/api/documents";
import { ApiRequestError } from "@/lib/api/client";

export function EmployeeProfile() {
  const { employeeId } = useParams<{ employeeId: string }>();
  const { ready, user } = useProtectedRoute();
  const [editOpen, setEditOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const employeeQuery = useQuery({ queryKey: businessKeys.employee(employeeId), queryFn: () => businessApi.employees.get(employeeId), enabled: ready });
  const employeesQuery = useQuery({ queryKey: businessKeys.employees, queryFn: () => businessApi.employees.list({}, 0, 100), enabled: ready });
  const departmentsQuery = useQuery({ queryKey: businessKeys.departments, queryFn: businessApi.departments.list, enabled: ready, retry: false });
  const tasksQuery = useQuery({ queryKey: [...businessKeys.tasks, "employee", employeeId], queryFn: () => businessApi.tasks.list({ assigneeId: employeeId, sort: "updated" }, 0, 100), enabled: ready });
  const projectsQuery = useQuery({ queryKey: [...businessKeys.projects, "employee", employeeId], queryFn: () => businessApi.projects.list({}, 0, 100), enabled: ready });
  const notesQuery = useQuery({ queryKey: [...businessKeys.notes, "employee", employeeId], queryFn: () => businessApi.notes.list({ employeeId }, 0, 50), enabled: ready });
  const documentsQuery = useQuery({ queryKey: ["documents", "employee", employeeId], queryFn: () => documentsApi.list({ ownerId: employeeId, limit: 50 }), enabled: ready, retry: false });
  const activityQuery = useQuery({ queryKey: [...businessKeys.activity, "employee", employeeId], queryFn: () => businessApi.activity.list("employee", employeeId), enabled: ready, retry: false });
  const employee = employeeQuery.data;
  const employees = employeesQuery.data?.items ?? [];
  const tasks = tasksQuery.data?.items ?? [];
  const projectIds = new Set(tasks.map((task) => task.project_id));
  const projects = (projectsQuery.data?.items ?? []).filter((project) => project.owner_id === employeeId || projectIds.has(project.id));
  const canManage = user?.role === "admin" || user?.role === "manager";
  const canEdit = canManage || user?.id === employeeId;
  const activityUnavailable = activityQuery.error instanceof ApiRequestError && activityQuery.error.status === 403;
  if (!ready || employeeQuery.isLoading) return <ProfileSkeleton />;
  if (employeeQuery.isError || !employee) return <ErrorState title="Employee unavailable" description="This profile may be outside your workspace access." retry={() => void employeeQuery.refetch()} />;
  const manager = employees.find((item) => item.id === employee.manager_id);
  return <div className="min-w-0 space-y-6">
    <Link href="/employees" className="inline-flex items-center gap-2 rounded-md text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"><ArrowLeft className="size-4" />Back to employees</Link>
    <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><EmploymentStatusBadge status={employee.employment_status} /><span className="text-xs uppercase tracking-wide text-muted-foreground">{employee.role}</span></div><h1 className="mt-3 break-words text-2xl font-semibold tracking-[-.03em] sm:text-3xl">{employeeName(employee)}</h1><p className="mt-1 text-sm text-muted-foreground">{employee.job_title ?? "Team member"} · {employee.department_name ?? "No department"}</p></div>{canEdit && <Button variant="outline" onClick={() => setEditOpen(true)}><Pencil className="size-4" />Edit profile</Button>}</header>
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Employee overview"><Metric label="Email" icon={Mail}><a className="break-all text-sm text-primary hover:underline" href={`mailto:${employee.email}`}>{employee.email}</a></Metric><Metric label="Phone" icon={Phone}><span className="text-sm">{employee.phone ?? "Not provided"}</span></Metric><Metric label="Manager" icon={UserRound}><EmployeeChip employee={manager} /></Metric><Metric label="Joined" icon={CalendarDays}><span className="text-sm">{formatDate(employee.hire_date)}</span></Metric></section>
    <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(19rem,.65fr)]"><div className="min-w-0 space-y-6">
      <Card><CardHeader><CardTitle>Assigned work</CardTitle><p className="text-sm text-muted-foreground">Projects and active tasks connected to this employee</p></CardHeader><CardContent className="space-y-6"><LinkedProjects projects={projects} /><LinkedTasks tasks={tasks} /></CardContent></Card>
      <Card><CardHeader className="flex-row items-center justify-between"><div><CardTitle>Notes</CardTitle><p className="mt-1 text-sm text-muted-foreground">Employee-related workspace context</p></div><Button variant="outline" size="sm" onClick={() => setNoteOpen(true)}>Add note</Button></CardHeader><CardContent>{notesQuery.data?.items.length ? <div className="grid gap-3 sm:grid-cols-2">{notesQuery.data.items.map((note) => <Link key={note.id} href={`/notes/${note.id}`} className="rounded-lg border p-4 outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"><p className="font-medium">{note.title}</p><p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm text-muted-foreground">{note.body}</p><p className="mt-3 text-xs text-muted-foreground">Updated {relativeDate(note.updated_at)}</p></Link>)}</div> : <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">No employee notes yet.</p>}</CardContent></Card>
    </div><aside className="min-w-0 space-y-6"><Card><CardHeader><CardTitle>Documents</CardTitle><p className="text-sm text-muted-foreground">Files owned by this employee</p></CardHeader><CardContent>{documentsQuery.data?.items.length ? <ul className="space-y-2">{documentsQuery.data.items.map((document) => <li key={document.id} className="flex min-w-0 items-center gap-2 rounded-lg border p-3"><FileText className="size-4 shrink-0 text-primary" /><span className="truncate text-sm">{document.title}</span></li>)}</ul> : <p className="text-sm text-muted-foreground">No owned documents.</p>}</CardContent></Card><Card><CardHeader><CardTitle>Recent activity</CardTitle></CardHeader><CardContent><ActivityFeed items={activityQuery.data?.items} employees={employees} loading={activityQuery.isLoading} unavailable={activityUnavailable} /></CardContent></Card></aside></div>
    <EmployeeFormDialog open={editOpen} onOpenChange={setEditOpen} employee={employee} departments={departmentsQuery.data ?? []} managers={employees} canManage={canManage} />
    <NoteFormDialog open={noteOpen} onOpenChange={setNoteOpen} employeeId={employee.id} />
  </div>;
}

function LinkedProjects({ projects }: { projects: NonNullable<Awaited<ReturnType<typeof businessApi.projects.list>>["items"]> }) { return <section aria-labelledby="employee-projects"><h2 id="employee-projects" className="mb-2 text-sm font-medium">Projects</h2>{projects.length ? <div className="grid gap-2 sm:grid-cols-2">{projects.map((project) => <Link key={project.id} href={`/projects/${project.id}`} className="flex items-center justify-between gap-3 rounded-lg border p-3 outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"><span className="truncate text-sm font-medium">{project.name}</span><ProjectStatusBadge status={project.status} /></Link>)}</div> : <p className="text-sm text-muted-foreground">No assigned projects.</p>}</section>; }
function LinkedTasks({ tasks }: { tasks: NonNullable<Awaited<ReturnType<typeof businessApi.tasks.list>>["items"]> }) { return <section aria-labelledby="employee-tasks"><h2 id="employee-tasks" className="mb-2 text-sm font-medium">Tasks</h2>{tasks.length ? <div className="divide-y rounded-lg border">{tasks.slice(0, 12).map((task) => <Link key={task.id} href={`/tasks/${task.id}`} className="flex flex-wrap items-center gap-2 p-3 outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"><span className="min-w-40 flex-1 truncate text-sm font-medium">{task.title}</span><TaskStatusBadge status={task.status} /><PriorityBadge priority={task.priority} /></Link>)}</div> : <p className="text-sm text-muted-foreground">No assigned tasks.</p>}</section>; }
function Metric({ label, icon: Icon, children }: { label: string; icon: typeof BriefcaseBusiness; children: React.ReactNode }) { return <Card><CardContent className="p-4"><p className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground"><Icon className="size-3.5" />{label}</p>{children}</CardContent></Card>; }
function ProfileSkeleton() { return <div className="space-y-6" role="status" aria-label="Loading employee profile"><Skeleton className="h-6 w-36" /><Skeleton className="h-28" /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-24" />)}</div><Skeleton className="h-96" /></div>; }
