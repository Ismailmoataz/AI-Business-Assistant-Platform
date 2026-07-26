"use client";

import * as Dropdown from "@radix-ui/react-dropdown-menu";
import { Bot, Building2, CalendarClock, Check, LayoutGrid, RotateCcw, Search, Settings2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { OPEN_GLOBAL_SEARCH_EVENT } from "@/components/search/global-search";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Company, UserRole } from "@/lib/types/api";
import { useUIStore } from "@/stores/ui-store";

export function DashboardToolbar({ firstName, company, role, employeeCount }: { firstName?: string; company: Company; role: UserRole; employeeCount: number }) {
  const layout = useUIStore((state) => state.dashboardLayout);
  const setLayout = useUIStore((state) => state.setDashboardLayout);
  const reset = useUIStore((state) => state.resetDashboard);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const timer = window.setInterval(() => setNow(new Date()), 30_000); return () => window.clearInterval(timer); }, []);
  const dateLabel = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" }).format(now);
  const timeLabel = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(now);
  const initials = company.name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "WS";
  const roleLabel = `${role[0].toUpperCase()}${role.slice(1)}`;

  return (
    <header className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
      <div>
        <Badge variant="secondary" className="mb-3"><CalendarClock className="mr-1 size-3" /><time dateTime={now.toISOString()} suppressHydrationWarning>{dateLabel} · {timeLabel}</time></Badge>
        <h1 className="text-2xl font-semibold tracking-[-.03em] sm:text-3xl">Welcome back{firstName ? `, ${firstName}` : ""}.</h1>
        <p className="mt-2 text-sm text-muted-foreground sm:text-base">A live view of the work, knowledge, and relationships that need your attention.</p>
        <div className="mt-4 inline-flex max-w-full items-center gap-3 rounded-xl border bg-card px-3 py-2 shadow-card" aria-label={`Company overview for ${company.name}`}>
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-foreground text-xs font-semibold text-background">{initials}</span>
          <span className="min-w-0"><span className="block truncate text-sm font-medium">{company.name}</span><span className="block truncate text-xs text-muted-foreground">{roleLabel} workspace · {employeeCount} {employeeCount === 1 ? "employee" : "employees"}</span></span>
          <Building2 className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => window.dispatchEvent(new Event(OPEN_GLOBAL_SEARCH_EVENT))}>
          <Search className="size-4" />Search
          <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">Ctrl K</kbd>
        </Button>
        <Button asChild><Link href="/assistant"><Bot className="size-4" />Ask AI</Link></Button>
        <Dropdown.Root>
          <Dropdown.Trigger asChild><Button variant="outline" size="icon" aria-label="Customize dashboard"><Settings2 className="size-4" /></Button></Dropdown.Trigger>
          <Dropdown.Portal>
            <Dropdown.Content align="end" sideOffset={8} className="z-50 w-64 rounded-xl border bg-card p-1.5 shadow-xl">
              <Dropdown.Label className="px-2 py-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Preferred layout</Dropdown.Label>
              <Dropdown.Item onSelect={() => setLayout("balanced")} className="flex cursor-default items-center gap-2 rounded-lg px-2 py-2 text-sm outline-none focus:bg-muted">
                <LayoutGrid className="size-4" />Balanced <Check className={`ml-auto size-4 ${layout === "balanced" ? "opacity-100" : "opacity-0"}`} />
              </Dropdown.Item>
              <Dropdown.Item onSelect={() => setLayout("compact")} className="flex cursor-default items-center gap-2 rounded-lg px-2 py-2 text-sm outline-none focus:bg-muted">
                <LayoutGrid className="size-4" />Compact <Check className={`ml-auto size-4 ${layout === "compact" ? "opacity-100" : "opacity-0"}`} />
              </Dropdown.Item>
              <Dropdown.Separator className="my-1 h-px bg-border" />
              <Dropdown.Item onSelect={reset} className="flex cursor-default items-center gap-2 rounded-lg px-2 py-2 text-sm outline-none focus:bg-muted">
                <RotateCcw className="size-4" />Reset dashboard
              </Dropdown.Item>
            </Dropdown.Content>
          </Dropdown.Portal>
        </Dropdown.Root>
      </div>
    </header>
  );
}
