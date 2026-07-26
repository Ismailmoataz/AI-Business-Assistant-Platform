"use client";

import { Activity as ActivityIcon, CalendarDays, CheckCircle2, Circle, CircleDot, CirclePause, Flag, LoaderCircle, UserRound } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, initials } from "@/lib/utils";
import type { Activity } from "@/lib/types/api";
import type { CustomerStatus, Employee, EmploymentStatus, ProjectStatus, Tag, TaskPriority, TaskStatus } from "@/lib/types/business";

export const PROJECT_STATUSES: ProjectStatus[] = ["planning", "active", "on_hold", "completed", "cancelled"];
export const TASK_STATUSES: TaskStatus[] = ["todo", "in_progress", "review", "blocked", "done"];
export const TASK_PRIORITIES: TaskPriority[] = ["low", "medium", "high", "urgent"];
export const EMPLOYMENT_STATUSES: EmploymentStatus[] = ["active", "on_leave", "inactive"];
export const CUSTOMER_STATUSES: CustomerStatus[] = ["prospect", "active", "inactive"];

export const projectStatusLabel: Record<ProjectStatus, string> = {
  planning: "Planning", active: "Active", on_hold: "On hold", completed: "Completed", cancelled: "Cancelled",
};
export const taskStatusLabel: Record<TaskStatus, string> = {
  todo: "Todo", in_progress: "In progress", review: "Review", blocked: "Blocked", done: "Completed",
};
export const priorityLabel: Record<TaskPriority, string> = { low: "Low", medium: "Medium", high: "High", urgent: "Urgent" };
export const employmentStatusLabel: Record<EmploymentStatus, string> = { active: "Active", on_leave: "On leave", inactive: "Inactive" };
export const customerStatusLabel: Record<CustomerStatus, string> = { active: "Active", prospect: "Prospect", inactive: "Inactive" };

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  const tone = status === "active" ? "bg-success/10 text-success" : status === "completed" ? "bg-primary/10 text-primary" : status === "cancelled" ? "bg-destructive/10 text-destructive" : status === "on_hold" ? "bg-warning/10 text-warning" : "";
  return <Badge variant="secondary" className={tone}>{projectStatusLabel[status]}</Badge>;
}

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  const tone = status === "done" ? "bg-success/10 text-success" : status === "review" ? "bg-primary/10 text-primary" : status === "blocked" ? "bg-destructive/10 text-destructive" : status === "in_progress" ? "bg-warning/10 text-warning" : "";
  return <Badge variant="secondary" className={tone}>{taskStatusLabel[status]}</Badge>;
}

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  const tone = priority === "urgent" ? "bg-destructive/10 text-destructive" : priority === "high" ? "bg-warning/10 text-warning" : priority === "low" ? "text-muted-foreground" : "text-primary";
  return <Badge variant="secondary" className={cn("gap-1", tone)}><Flag className="size-3" />{priorityLabel[priority]}</Badge>;
}

export function EmploymentStatusBadge({ status }: { status: EmploymentStatus }) {
  const tone = status === "active" ? "bg-success/10 text-success" : status === "on_leave" ? "bg-warning/10 text-warning" : "text-muted-foreground";
  return <Badge variant="secondary" className={tone}>{employmentStatusLabel[status]}</Badge>;
}

export function CustomerStatusBadge({ status }: { status: CustomerStatus }) {
  const tone = status === "active" ? "bg-success/10 text-success" : status === "prospect" ? "bg-primary/10 text-primary" : "text-muted-foreground";
  return <Badge variant="secondary" className={tone}>{customerStatusLabel[status]}</Badge>;
}

export function ProgressBar({ value, label = true }: { value: number; label?: boolean }) {
  const bounded = Math.max(0, Math.min(100, Math.round(value)));
  return <div className="min-w-24" aria-label={`${bounded}% complete`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={bounded}>
    <div className="flex items-center gap-2"><div className="h-1.5 min-w-16 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${bounded}%` }} /></div>{label && <span className="text-xs tabular-nums text-muted-foreground">{bounded}%</span>}</div>
  </div>;
}

export function EmployeeChip({ employee, compact = false }: { employee?: Employee; compact?: boolean }) {
  if (!employee) return <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground"><UserRound className="size-3.5" />Unassigned</span>;
  const name = employeeName(employee);
  return <span className="inline-flex min-w-0 items-center gap-2"><Avatar className="size-7"><AvatarFallback>{initials(employee.first_name, employee.last_name)}</AvatarFallback></Avatar>{!compact && <span className="truncate text-sm">{name}</span>}</span>;
}

export function TagPills({ tags, limit }: { tags: Tag[]; limit?: number }) {
  const visible = typeof limit === "number" ? tags.slice(0, limit) : tags;
  if (!tags.length) return null;
  return <div className="flex min-w-0 flex-wrap gap-1.5">{visible.map((tag) => <span key={tag.id} className="inline-flex max-w-36 items-center gap-1 truncate rounded-full border bg-card px-2 py-0.5 text-[11px] text-muted-foreground"><span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: tag.color ?? "var(--primary)" }} />{tag.name}</span>)}{limit && tags.length > limit ? <span className="text-[11px] text-muted-foreground">+{tags.length - limit}</span> : null}</div>;
}

export function SelectControl({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn("h-10 max-w-full rounded-lg border border-input bg-card px-3 text-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20 disabled:opacity-50", className)} {...props}>{children}</select>;
}

export function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel = "Delete", pending, onConfirm }: { open: boolean; onOpenChange: (open: boolean) => void; title: string; description: string; confirmLabel?: string; pending?: boolean; onConfirm: () => void }) {
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-w-md"><DialogTitle className="text-lg font-semibold">{title}</DialogTitle><DialogDescription className="mt-2 text-sm text-muted-foreground">{description}</DialogDescription><div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose><Button variant="destructive" disabled={pending} onClick={onConfirm}>{pending && <LoaderCircle className="size-4 animate-spin" />}{confirmLabel}</Button></div></DialogContent></Dialog>;
}

export function ActivityFeed({ items, employees, loading, unavailable = false }: { items?: Activity[]; employees: Employee[]; loading?: boolean; unavailable?: boolean }) {
  if (loading) return <div className="space-y-3" role="status" aria-label="Loading activity"><Skeleton className="h-12" /><Skeleton className="h-12" /><Skeleton className="h-12" /></div>;
  if (unavailable) return <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Activity history is available to managers and administrators.</p>;
  if (!items?.length) return <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">No activity has been recorded for this item yet.</p>;
  return <ol className="space-y-1">{items.map((item) => { const actor = employees.find((employee) => employee.id === item.actor_id); return <li key={item.id} className="flex gap-3 rounded-lg p-2.5 hover:bg-muted/60"><span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground"><ActivityIcon className="size-3.5" /></span><div className="min-w-0 flex-1"><p className="text-sm">{item.summary}</p><p className="mt-1 text-xs text-muted-foreground">{actor ? employeeName(actor) : "Former workspace member"} · {relativeDate(item.created_at)}</p></div></li>; })}</ol>;
}

export function EmptyDueDate() { return <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground"><CalendarDays className="size-3.5" />No due date</span>; }

export function statusIcon(status: TaskStatus) {
  return status === "done" ? CheckCircle2 : status === "in_progress" ? CircleDot : status === "review" ? CirclePause : Circle;
}

export function employeeName(employee?: Employee) { return employee ? `${employee.first_name} ${employee.last_name}` : "Unassigned"; }
export function tagUsageCount(tag: Tag) { return tag.customer_count + tag.project_count + tag.task_count + tag.note_count; }
export function formatDate(value: string | null | undefined, fallback = "Not set") { return value ? new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${value}T00:00:00`)) : fallback; }
export function relativeDate(value: string) { const date = new Date(value); const difference = date.getTime() - Date.now(); const days = Math.round(difference / 86400000); const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" }); if (Math.abs(days) < 1) return "today"; if (Math.abs(days) < 30) return formatter.format(days, "day"); return date.toLocaleDateString(); }
