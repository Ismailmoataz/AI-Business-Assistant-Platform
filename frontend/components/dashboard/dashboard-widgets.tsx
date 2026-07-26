import { Bot, CalendarDays, FileText, FolderKanban, ListTodo, Users, UserRound } from "lucide-react";
import Link from "next/link";
import { PriorityBadge, ProgressBar, ProjectStatusBadge, TaskStatusBadge, formatDate, relativeDate } from "@/components/business/shared";
import { PromptCard } from "@/components/dashboard/prompt-card";
import { WidgetShell } from "@/components/dashboard/widget-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import type { DashboardOverview } from "@/lib/types/dashboard";

interface WidgetPosition { index: number; total: number }

export function MyWorkWidget({ data, index, total }: WidgetPosition & { data: DashboardOverview["my_work"] }) {
  return (
    <WidgetShell id="my-work" title="My work" description="Your assigned priorities and deadlines" icon={ListTodo} index={index} total={total}>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Count label="Assigned" value={data.assigned} />
        <Count label="Due today" value={data.due_today} tone={data.due_today ? "warning" : undefined} />
        <Count label="Overdue" value={data.overdue} tone={data.overdue ? "danger" : undefined} />
        <Count label="Upcoming" value={data.upcoming} />
      </div>
      {data.items.length ? (
        <ul className="mt-5 divide-y" aria-label="Highest-priority assigned tasks">
          {data.items.map((task) => (
            <li key={task.id} className="flex min-w-0 items-center gap-3 py-3 first:pt-0 last:pb-0">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted"><ListTodo className="size-4 text-muted-foreground" /></span>
              <div className="min-w-0 flex-1">
                <Link href={`/tasks/${task.id}`} className="block truncate rounded-sm text-sm font-medium outline-none hover:text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring">{task.title}</Link>
                <p className="truncate text-xs text-muted-foreground">{task.project_name} · {formatDate(task.due_date, "No due date")}</p>
              </div>
              <div className="hidden items-center gap-2 sm:flex"><PriorityBadge priority={task.priority} /><TaskStatusBadge status={task.status} /></div>
            </li>
          ))}
        </ul>
      ) : <div className="mt-5"><EmptyState icon={ListTodo} title="Your queue is clear" description="No open tasks are currently assigned to you." /></div>}
      <div className="mt-5 flex justify-end"><Button variant="outline" size="sm" asChild><Link href="/tasks">Open Tasks</Link></Button></div>
    </WidgetShell>
  );
}

function Count({ label, value, tone }: { label: string; value: number; tone?: "warning" | "danger" }) {
  const toneClass = tone === "danger" ? "text-destructive" : tone === "warning" ? "text-warning" : "text-foreground";
  return <div className="rounded-lg border bg-muted/30 p-3"><p className={`text-xl font-semibold ${toneClass}`}>{value}</p><p className="mt-0.5 text-xs text-muted-foreground">{label}</p></div>;
}

export function ProjectsWidget({ data, index, total }: WidgetPosition & { data: DashboardOverview["projects"] }) {
  const healthLabel = { on_track: "On track", watch: "Watch", at_risk: "At risk", planned: "Planned" } as const;
  return (
    <WidgetShell id="projects" title="Projects" description="Progress, health, deadlines, and recent updates" icon={FolderKanban} index={index} total={total}>
      {data.length ? <ul className="space-y-4">
        {data.map((project) => (
          <li key={project.id} className="rounded-lg border p-4">
            <div className="flex min-w-0 items-start gap-3">
              <div className="min-w-0 flex-1">
                <Link href={`/projects/${project.id}`} className="block truncate rounded-sm font-medium outline-none hover:text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring">{project.name}</Link>
                <div className="mt-2 flex flex-wrap gap-2"><ProjectStatusBadge status={project.status} /><Badge variant={project.health === "at_risk" ? "warning" : project.health === "on_track" ? "success" : "secondary"}>{healthLabel[project.health]}</Badge></div>
              </div>
              <span className="text-right text-xs text-muted-foreground"><CalendarDays className="mr-1 inline size-3" />{formatDate(project.end_date, "No deadline")}</span>
            </div>
            <div className="mt-4"><ProgressBar value={project.progress} /></div>
            <p className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-muted-foreground"><span>{project.open_tasks} open tasks{project.overdue_tasks ? ` · ${project.overdue_tasks} overdue` : ""}</span><span>Updated {relativeDate(project.updated_at)}</span></p>
          </li>
        ))}
      </ul> : <EmptyState icon={FolderKanban} title="No current projects" description="Planning, active, and on-hold projects will appear here." />}
      <div className="mt-5 flex justify-end"><Button variant="outline" size="sm" asChild><Link href="/projects">View all projects</Link></Button></div>
    </WidgetShell>
  );
}

export function DocumentsWidget({ data, index, total }: WidgetPosition & { data: DashboardOverview["documents"] }) {
  const statuses = [
    { label: "Queued", value: data.uploaded },
    { label: "Processing", value: data.processing },
    { label: "Ready", value: data.ready },
    { label: "Failed", value: data.failed, danger: true },
  ];
  return (
    <WidgetShell id="documents" title="Documents" description="Recent uploads and processing health" icon={FileText} index={index} total={total}>
      <div className="grid grid-cols-4 gap-2">{statuses.map((status) => <div key={status.label} className="rounded-lg bg-muted/45 p-2.5 text-center"><p className={`font-semibold ${status.danger && status.value ? "text-destructive" : ""}`}>{status.value}</p><p className="text-[11px] text-muted-foreground">{status.label}</p></div>)}</div>
      {data.recent.length ? <ul className="mt-5 divide-y" aria-label="Recently uploaded documents">
        {data.recent.map((document) => <li key={document.id} className="flex min-w-0 items-center gap-3 py-3 first:pt-0 last:pb-0"><span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted"><FileText className="size-4 text-muted-foreground" /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{document.title}</p><p className="truncate text-xs text-muted-foreground">{document.filename} · {relativeDate(document.updated_at)}</p></div><Badge variant={document.processing_status === "failed" ? "warning" : document.processing_status === "ready" ? "success" : "secondary"}>{document.processing_status}</Badge></li>)}
      </ul> : <div className="mt-5"><EmptyState icon={FileText} title="No documents yet" description="Uploaded documents and their processing state will appear here." /></div>}
      <div className="mt-5 flex justify-end"><Button variant="outline" size="sm" asChild><Link href="/documents">Open Documents Workspace</Link></Button></div>
    </WidgetShell>
  );
}

export function AiWidget({ data, index, total }: WidgetPosition & { data: DashboardOverview["conversations"] }) {
  return (
    <WidgetShell id="ai" title="AI workspace" description="Ask, resume, and explore company knowledge" icon={Bot} index={index} total={total}>
      <PromptCard embedded />
      <div className="mt-5 flex items-center justify-between"><h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Recent conversations</h3><Button variant="ghost" size="sm" asChild><Link href="/assistant">Start new</Link></Button></div>
      {data.length ? <ul className="mt-2 divide-y">{data.map((conversation) => <li key={conversation.id} className="py-3"><Link href={`/assistant?conversation=${conversation.id}`} className="block min-w-0 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"><span className="block truncate text-sm font-medium hover:text-primary">{conversation.title ?? "Untitled conversation"}</span><span className="mt-0.5 block truncate text-xs text-muted-foreground">{conversation.last_message_preview ?? "Resume this conversation"}</span></Link></li>)}</ul> : <p className="mt-3 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">No conversations yet. Start with one of the prompts above.</p>}
    </WidgetShell>
  );
}

export function CustomersWidget({ data, index, total }: WidgetPosition & { data: DashboardOverview["customers"] }) {
  return (
    <WidgetShell id="customers" title="Customers" description="New relationships and recent changes" icon={Users} index={index} total={total}>
      {!data.available ? <EmptyState icon={Users} title="Customer insights are restricted" description={data.unavailable_reason ?? "Your role does not include access to customer records."} /> : <>
        <div className="grid gap-5 sm:grid-cols-2">
          <CustomerList title="Recently added" items={data.recently_added} />
          <CustomerList title="Recently updated" items={data.recently_updated} />
        </div>
        {data.activity.length > 0 && <div className="mt-5 border-t pt-4"><h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Important activity</h3>{data.activity.map((item) => <p key={item.id} className="mt-2 truncate text-sm">{item.summary} <span className="text-xs text-muted-foreground">· {relativeDate(item.created_at)}</span></p>)}</div>}
        <div className="mt-5 flex justify-end"><Button variant="outline" size="sm" asChild><Link href="/customers">Open customers</Link></Button></div>
      </>}
    </WidgetShell>
  );
}

function CustomerList({ title, items }: { title: string; items: DashboardOverview["customers"]["recently_added"] }) {
  return <section><h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</h3>{items.length ? <ul className="mt-2 space-y-2">{items.slice(0, 3).map((customer) => <li key={customer.id}><Link href={`/customers/${customer.id}`} className="block min-w-0 rounded-md border p-3 outline-none hover:bg-muted/45 focus-visible:ring-2 focus-visible:ring-ring"><span className="block truncate text-sm font-medium">{customer.name}</span><span className="block truncate text-xs text-muted-foreground">{customer.contact_name ?? customer.status}</span></Link></li>)}</ul> : <p className="mt-2 text-sm text-muted-foreground">No recent changes.</p>}</section>;
}

export function EmployeesWidget({ data, index, total }: WidgetPosition & { data: DashboardOverview["employees"] }) {
  return (
    <WidgetShell id="employees" title="Employees" description="Recent updates and assigned workload" icon={UserRound} index={index} total={total}>
      <div className="grid gap-5 sm:grid-cols-2">
        <EmployeeList title="Assigned workload" items={data.workload} workload />
        <EmployeeList title="Recently updated" items={data.recently_updated} />
      </div>
      {data.activity_available && data.activity.length > 0 && <div className="mt-5 border-t pt-4"><h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Recent employee activity</h3>{data.activity.map((item) => <p key={item.id} className="mt-2 truncate text-sm">{item.summary} <span className="text-xs text-muted-foreground">· {relativeDate(item.created_at)}</span></p>)}</div>}
      <div className="mt-5 flex justify-end"><Button variant="outline" size="sm" asChild><Link href="/employees">Open employees</Link></Button></div>
    </WidgetShell>
  );
}

function EmployeeList({ title, items, workload = false }: { title: string; items: DashboardOverview["employees"]["workload"]; workload?: boolean }) {
  return <section><h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</h3>{items.length ? <ul className="mt-2 space-y-2">{items.slice(0, 4).map((employee) => <li key={employee.id}><Link href={`/employees/${employee.id}`} className="flex min-w-0 items-center gap-3 rounded-md border p-3 outline-none hover:bg-muted/45 focus-visible:ring-2 focus-visible:ring-ring"><span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent text-xs font-medium text-accent-foreground">{employee.first_name[0]}{employee.last_name[0]}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{employee.first_name} {employee.last_name}</span><span className="block truncate text-xs text-muted-foreground">{employee.job_title ?? employee.role}</span></span>{workload && <Badge variant={employee.assigned_task_count > 8 ? "warning" : "secondary"}>{employee.assigned_task_count} tasks</Badge>}</Link></li>)}</ul> : <p className="mt-2 text-sm text-muted-foreground">No employee updates.</p>}</section>;
}
