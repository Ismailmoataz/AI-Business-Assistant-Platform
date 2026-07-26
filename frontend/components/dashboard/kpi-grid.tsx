import { Bot, CheckCircle2, Database, FileText, FolderKanban, ListTodo, NotebookPen, UserRound, Users } from "lucide-react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import type { DashboardKpis } from "@/lib/types/dashboard";

function formatBytes(value: number | null) {
  if (value === null) return "—";
  if (value === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const unit = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  return `${(value / 1024 ** unit).toFixed(unit > 1 ? 1 : 0)} ${units[unit]}`;
}

export function KpiGrid({ kpis }: { kpis: DashboardKpis }) {
  const items = [
    { label: "Active projects", value: kpis.active_projects, href: "/projects", icon: FolderKanban },
    { label: "Open tasks", value: kpis.open_tasks, href: "/tasks", icon: ListTodo },
    { label: "Completed tasks", value: kpis.completed_tasks, href: "/tasks", icon: CheckCircle2 },
    { label: "Employees", value: kpis.employees, href: "/employees", icon: UserRound },
    { label: "Customers", value: kpis.customers ?? "Restricted", href: "/customers", icon: Users },
    { label: "Documents", value: kpis.documents, href: "/documents", icon: FileText },
    { label: "Storage used", value: formatBytes(kpis.storage_bytes), href: "/documents", icon: Database },
    { label: "AI conversations", value: kpis.ai_conversations, href: "/assistant", icon: Bot },
    { label: "Notes", value: kpis.notes, href: "/notes", icon: NotebookPen },
  ];
  return (
    <section aria-labelledby="dashboard-kpis">
      <h2 id="dashboard-kpis" className="sr-only">Workspace key performance indicators</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 2xl:grid-cols-9">
        {items.map(({ label, value, href, icon: Icon }) => (
          <Link key={label} href={href} className="group rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Card className="h-full transition group-hover:-translate-y-0.5 group-hover:border-primary/25 group-hover:shadow-lg">
              <CardContent className="p-4">
                <span className="grid size-8 place-items-center rounded-lg bg-accent text-accent-foreground"><Icon className="size-4" /></span>
                <p className="mt-4 truncate text-xl font-semibold tracking-tight sm:text-2xl" title={String(value)}>{value}</p>
                <p className="mt-1 text-xs text-muted-foreground">{label}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
}
