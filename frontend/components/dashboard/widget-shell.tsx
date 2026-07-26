"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useUIStore, type DashboardWidgetId } from "@/stores/ui-store";

interface WidgetShellProps {
  id: DashboardWidgetId;
  title: string;
  description: string;
  icon: LucideIcon;
  index: number;
  total: number;
  className?: string;
  children: React.ReactNode;
}

export function WidgetShell({ id, title, description, icon: Icon, index, total, className, children }: WidgetShellProps) {
  const collapsed = useUIStore((state) => Boolean(state.dashboardCollapsed[id]));
  const move = useUIStore((state) => state.moveDashboardWidget);
  const toggle = useUIStore((state) => state.toggleDashboardWidget);
  const contentId = `dashboard-${id}-content`;

  return (
    <Card className={cn("self-start overflow-hidden", className)}>
      <CardHeader className="flex-row items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground" aria-hidden="true">
          <Icon className="size-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold tracking-[-.015em]">{title}</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <Button variant="ghost" size="icon" className="size-8" aria-label={`Move ${title} up`} disabled={index === 0} onClick={() => move(id, -1)}>
            <ChevronUp className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" className="size-8" aria-label={`Move ${title} down`} disabled={index === total - 1} onClick={() => move(id, 1)}>
            <ChevronDown className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="ml-1"
            aria-label={`${collapsed ? "Expand" : "Collapse"} ${title}`}
            aria-expanded={!collapsed}
            aria-controls={contentId}
            onClick={() => toggle(id)}
          >
            {collapsed ? "Expand" : "Collapse"}
          </Button>
        </div>
      </CardHeader>
      {!collapsed && <CardContent id={contentId}>{children}</CardContent>}
    </Card>
  );
}
