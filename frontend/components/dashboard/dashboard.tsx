"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { AiWidget, CustomersWidget, DocumentsWidget, EmployeesWidget, MyWorkWidget, ProjectsWidget } from "@/components/dashboard/dashboard-widgets";
import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton";
import { DashboardToolbar } from "@/components/dashboard/dashboard-toolbar";
import { ExecutiveBrief } from "@/components/dashboard/executive-brief";
import { KpiGrid } from "@/components/dashboard/kpi-grid";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useProtectedRoute } from "@/hooks/use-protected-route";
import { dashboardKeys, getDashboardOverview } from "@/lib/api/dashboard";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";
import { defaultDashboardOrder, useUIStore, type DashboardWidgetId } from "@/stores/ui-store";

const ActivityWidget = dynamic(() => import("./activity-widget").then((module) => module.ActivityWidget), { loading: () => <Skeleton className="h-96 rounded-xl xl:col-span-2" /> });

export function Dashboard() {
  const { ready } = useProtectedRoute();
  const setUser = useAuthStore((state) => state.setUser);
  const setCompany = useAuthStore((state) => state.setCompany);
  const storedOrder = useUIStore((state) => state.dashboardWidgetOrder);
  const layout = useUIStore((state) => state.dashboardLayout);
  const query = useQuery({ queryKey: dashboardKeys.overview, queryFn: getDashboardOverview, enabled: ready, staleTime: 5 * 60_000 });
  useEffect(() => { if (query.data?.user) setUser(query.data.user); }, [query.data?.user, setUser]);
  useEffect(() => { if (query.data?.company) setCompany(query.data.company); }, [query.data?.company, setCompany]);
  const order = useMemo(() => {
    const valid = storedOrder.filter((id): id is DashboardWidgetId => defaultDashboardOrder.includes(id));
    return [...valid, ...defaultDashboardOrder.filter((id) => !valid.includes(id))];
  }, [storedOrder]);

  if (!ready || query.isLoading) return <DashboardSkeleton />;
  if (query.isError || !query.data) return <ErrorState title="The executive dashboard could not be loaded" description="Your workspace data is unchanged. Try loading the dashboard again." retry={() => void query.refetch()} />;
  const data = query.data;
  const renderWidget = (id: DashboardWidgetId, index: number) => {
    const position = { index, total: order.length };
    switch (id) {
      case "my-work": return <MyWorkWidget key={id} data={data.my_work} {...position} />;
      case "projects": return <ProjectsWidget key={id} data={data.projects} {...position} />;
      case "documents": return <DocumentsWidget key={id} data={data.documents} {...position} />;
      case "ai": return <AiWidget key={id} data={data.conversations} {...position} />;
      case "customers": return <CustomersWidget key={id} data={data.customers} {...position} />;
      case "employees": return <EmployeesWidget key={id} data={data.employees} {...position} />;
      case "activity": return <ActivityWidget key={id} {...position} />;
    }
  };

  return <div className={cn("space-y-6", layout === "compact" && "space-y-4")}>
    <DashboardToolbar firstName={data.user.first_name} company={data.company} role={data.user.role} employeeCount={data.kpis.employees} />
    <ExecutiveBrief brief={data.brief} />
    <KpiGrid kpis={data.kpis} />
    <QuickActions role={data.user.role} />
    <section aria-label="Personalized dashboard widgets" className={cn("grid items-start gap-5 xl:grid-cols-2", layout === "compact" && "gap-4 2xl:grid-cols-3")}>
      {order.map(renderWidget)}
    </section>
  </div>;
}
