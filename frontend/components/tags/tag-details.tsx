"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, FileText, FolderKanban, ListTodo, UsersRound } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ActivityFeed, CustomerStatusBadge, ProjectStatusBadge, TaskStatusBadge, tagUsageCount } from "@/components/business/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useProtectedRoute } from "@/hooks/use-protected-route";
import { ApiRequestError } from "@/lib/api/client";
import { businessApi, businessKeys } from "@/lib/api/business";

export function TagDetails() {
  const { tagId } = useParams<{ tagId: string }>(); const { ready } = useProtectedRoute();
  const tagQuery = useQuery({ queryKey: businessKeys.tag(tagId), queryFn: () => businessApi.tags.get(tagId), enabled: ready });
  const customersQuery = useQuery({ queryKey: [...businessKeys.customers, "tag", tagId], queryFn: () => businessApi.customers.list({ tagId }, 0, 100), enabled: ready, retry: false });
  const projectsQuery = useQuery({ queryKey: [...businessKeys.projects, "tag", tagId], queryFn: () => businessApi.projects.list({ tagId }, 0, 100), enabled: ready });
  const tasksQuery = useQuery({ queryKey: [...businessKeys.tasks, "tag", tagId], queryFn: () => businessApi.tasks.list({ tagId }, 0, 100), enabled: ready });
  const notesQuery = useQuery({ queryKey: [...businessKeys.notes, "tag", tagId], queryFn: () => businessApi.notes.list({ tagId }, 0, 100), enabled: ready });
  const employeesQuery = useQuery({ queryKey: businessKeys.employees, queryFn: () => businessApi.employees.list({}, 0, 100), enabled: ready });
  const activityQuery = useQuery({ queryKey: [...businessKeys.activity, "tag", tagId], queryFn: () => businessApi.activity.list("tag", tagId), enabled: ready, retry: false });
  const tag = tagQuery.data; if (!ready || tagQuery.isLoading) return <DetailsSkeleton />; if (tagQuery.isError || !tag) return <ErrorState title="Tag unavailable" retry={() => void tagQuery.refetch()} />;
  const unavailable = activityQuery.error instanceof ApiRequestError && activityQuery.error.status === 403;
  return <div className="min-w-0 space-y-6"><Link href="/tags" className="inline-flex items-center gap-2 rounded-md text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"><ArrowLeft className="size-4" />Back to tags</Link><header><div className="flex items-center gap-3"><span className="size-4 rounded-full ring-4 ring-muted" style={{ backgroundColor: tag.color ?? "var(--primary)" }} /><h1 className="text-2xl font-semibold tracking-[-.03em] sm:text-3xl">{tag.name}</h1></div><p className="mt-2 text-sm text-muted-foreground">Used by {tagUsageCount(tag)} workspace records.</p></header><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Customers" value={tag.customer_count} /><Metric label="Projects" value={tag.project_count} /><Metric label="Tasks" value={tag.task_count} /><Metric label="Notes" value={tag.note_count} /></div>
    <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(19rem,.6fr)]"><div className="grid min-w-0 gap-6 md:grid-cols-2"><Linked title="Customers" icon={UsersRound} items={(customersQuery.data?.items ?? []).map((item) => ({ id: item.id, href: `/customers/${item.id}`, name: item.name, badge: <CustomerStatusBadge status={item.status} /> }))} /><Linked title="Projects" icon={FolderKanban} items={(projectsQuery.data?.items ?? []).map((item) => ({ id: item.id, href: `/projects/${item.id}`, name: item.name, badge: <ProjectStatusBadge status={item.status} /> }))} /><Linked title="Tasks" icon={ListTodo} items={(tasksQuery.data?.items ?? []).map((item) => ({ id: item.id, href: `/tasks/${item.id}`, name: item.title, badge: <TaskStatusBadge status={item.status} /> }))} /><Linked title="Notes" icon={FileText} items={(notesQuery.data?.items ?? []).map((item) => ({ id: item.id, href: `/notes/${item.id}`, name: item.title }))} /></div><Card><CardHeader><CardTitle>Activity history</CardTitle></CardHeader><CardContent><ActivityFeed items={activityQuery.data?.items} employees={employeesQuery.data?.items ?? []} loading={activityQuery.isLoading} unavailable={unavailable} /></CardContent></Card></div>
  </div>;
}

function Linked({ title, icon: Icon, items }: { title: string; icon: typeof FileText; items: Array<{ id: string; href: string; name: string; badge?: React.ReactNode }> }) { return <Card className="min-w-0"><CardHeader><CardTitle className="flex items-center gap-2"><Icon className="size-4 text-primary" />{title}</CardTitle></CardHeader><CardContent>{items.length ? <ul className="space-y-2">{items.map((item) => <li key={item.id}><Link href={item.href} className="flex min-w-0 items-center justify-between gap-2 rounded-lg border p-3 outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"><span className="truncate text-sm font-medium">{item.name}</span>{item.badge}</Link></li>)}</ul> : <p className="text-sm text-muted-foreground">No linked {title.toLowerCase()}.</p>}</CardContent></Card>; }
function Metric({ label, value }: { label: string; value: number }) { return <Card><CardContent className="p-4"><p className="text-2xl font-semibold tabular-nums">{value}</p><p className="text-xs text-muted-foreground">{label}</p></CardContent></Card>; }
function DetailsSkeleton() { return <div className="space-y-6" role="status" aria-label="Loading tag"><Skeleton className="h-6 w-28" /><Skeleton className="h-24" /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-24" />)}</div><Skeleton className="h-96" /></div>; }
