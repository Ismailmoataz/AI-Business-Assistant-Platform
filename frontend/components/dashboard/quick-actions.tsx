import { Bot, FolderPlus, ListPlus, NotebookPen, Upload, UserPlus } from "lucide-react";
import Link from "next/link";
import type { UserRole } from "@/lib/types/api";

export function QuickActions({ role }: { role: UserRole }) {
  const actions = [
    { label: "Upload document", description: "Add company knowledge", href: "/documents", icon: Upload, management: false },
    { label: "Create project", description: "Plan a new outcome", href: "/projects", icon: FolderPlus, management: true },
    { label: "Create task", description: "Assign the next action", href: "/tasks", icon: ListPlus, management: true },
    { label: "Add customer", description: "Create a relationship", href: "/customers", icon: UserPlus, management: true },
    { label: "Create note", description: "Capture durable context", href: "/notes", icon: NotebookPen, management: false },
    { label: "Open AI assistant", description: "Explore business knowledge", href: "/assistant", icon: Bot, management: false },
  ].filter((action) => !action.management || role !== "employee");

  return (
    <section aria-labelledby="dashboard-quick-actions">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h2 id="dashboard-quick-actions" className="font-semibold tracking-[-.015em]">Quick actions</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">Jump into common work without duplicating workspace workflows.</p>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {actions.map(({ label, description, href, icon: Icon }) => (
          <Link key={label} href={href} className="group flex min-w-0 items-center gap-3 rounded-xl border bg-card p-3 shadow-card outline-none transition hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground" aria-hidden="true"><Icon className="size-4" /></span>
            <span className="min-w-0"><span className="block truncate text-sm font-medium">{label}</span><span className="block truncate text-xs text-muted-foreground">{description}</span></span>
          </Link>
        ))}
      </div>
    </section>
  );
}
