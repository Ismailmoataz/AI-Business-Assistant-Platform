"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { Building2, FileText, FolderKanban, ListTodo, NotebookPen, RefreshCw, UserRound } from "lucide-react";
import Link from "next/link";
import { relativeDate } from "@/components/business/shared";
import { WidgetShell } from "@/components/dashboard/widget-shell";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { businessApi, businessKeys } from "@/lib/api/business";
import { ApiRequestError } from "@/lib/api/client";

const PAGE_SIZE = 8;

export function ActivityWidget({ index, total }: { index: number; total: number }) {
  const query = useInfiniteQuery({
    queryKey: [...businessKeys.activity, "dashboard-feed"],
    queryFn: ({ pageParam }) => businessApi.activity.feed(pageParam, PAGE_SIZE),
    initialPageParam: 0,
    getNextPageParam: (page) => {
      const next = page.page.offset + page.items.length;
      return next < page.page.total ? next : undefined;
    },
    retry: (count, error) => !(error instanceof ApiRequestError && error.status === 403) && count < 1,
  });
  const activities = query.data?.pages.flatMap((page) => page.items) ?? [];
  const restricted = query.error instanceof ApiRequestError && query.error.status === 403;

  return (
    <WidgetShell id="activity" title="Recent activity" description="A unified, paginated timeline across the workspace" icon={RefreshCw} index={index} total={total} className="xl:col-span-2 2xl:col-span-2">
      {query.isLoading ? <div className="space-y-3" role="status" aria-label="Loading activity"><Skeleton className="h-14" /><Skeleton className="h-14" /><Skeleton className="h-14" /></div>
        : restricted ? <EmptyState icon={RefreshCw} title="Activity is restricted" description="Company activity history is available to managers and administrators." />
          : query.isError ? <div role="alert" className="rounded-lg border border-destructive/30 p-5 text-center"><p className="text-sm font-medium">Activity could not be loaded.</p><Button variant="outline" size="sm" className="mt-3" onClick={() => void query.refetch()}><RefreshCw className="size-3.5" />Try again</Button></div>
            : activities.length ? <>
              <ol className="grid gap-x-6 md:grid-cols-2" aria-label="Workspace activity timeline">
                {activities.map((activity) => {
                  const meta = activityMeta(activity.entity_type, activity.entity_id);
                  const Icon = meta.icon;
                  return <li key={activity.id} className="flex min-w-0 items-center gap-3 border-b py-3"><span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground"><Icon className="size-4" /></span><div className="min-w-0 flex-1">{meta.href ? <Link href={meta.href} className="block truncate rounded-sm text-sm font-medium outline-none hover:text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring">{activity.summary}</Link> : <p className="truncate text-sm font-medium">{activity.summary}</p>}<p className="text-xs capitalize text-muted-foreground">{activity.entity_type} · {relativeDate(activity.created_at)}</p></div></li>;
                })}
              </ol>
              {query.hasNextPage && <div className="mt-5 flex justify-center"><Button variant="outline" size="sm" disabled={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>{query.isFetchingNextPage && <RefreshCw className="size-3.5 animate-spin" />}Load more activity</Button></div>}
            </> : <EmptyState icon={RefreshCw} title="No recent activity" description="Project, task, document, employee, customer, and note changes will appear here." />}
    </WidgetShell>
  );
}

function activityMeta(entityType: string, entityId: string) {
  switch (entityType) {
    case "project": return { icon: FolderKanban, href: `/projects/${entityId}` };
    case "task": return { icon: ListTodo, href: `/tasks/${entityId}` };
    case "document": return { icon: FileText, href: "/documents" };
    case "user":
    case "employee": return { icon: UserRound, href: `/employees/${entityId}` };
    case "customer": return { icon: Building2, href: `/customers/${entityId}` };
    case "note": return { icon: NotebookPen, href: `/notes/${entityId}` };
    default: return { icon: FileText, href: null };
  }
}

