"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Bot, Building2, ChevronLeft, FileText, FolderKanban, LayoutDashboard, ListTodo, NotebookPen, Settings, Tags, UserRound, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";
import { useUIStore } from "@/stores/ui-store";

const nav = [
  { label: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { label: "AI Workspace", href: "/assistant", icon: Bot },
  { label: "Documents", href: "/documents", icon: FileText },
  { label: "Projects", href: "/projects", icon: FolderKanban },
  { label: "Tasks", href: "/tasks", icon: ListTodo },
  { label: "Customers", href: "/customers", icon: Users },
  { label: "Employees", href: "/employees", icon: UserRound },
  { label: "Notes", href: "/notes", icon: NotebookPen },
  { label: "Tags", href: "/tags", icon: Tags },
];

function Brand({ compact = false }: { compact?: boolean }) { return <Link href="/dashboard" className="flex items-center gap-2.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"><span className="grid size-8 shrink-0 place-items-center rounded-[10px] bg-primary text-sm font-bold text-white shadow-sm">O</span>{!compact && <span className="text-[15px] font-semibold tracking-tight">Orbit</span>}</Link>; }

export function SidebarContent({ mobile = false }: { mobile?: boolean }) {
  const path = usePathname(); const { sidebarCollapsed, toggleSidebar, setMobileOpen } = useUIStore(); const company = useAuthStore((state) => state.company); const compact = !mobile && sidebarCollapsed; const workspaceName = company?.name ?? "Your workspace"; const workspaceInitials = company?.name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "WS";
  return <div className="flex h-full flex-col"><div className={cn("flex h-16 items-center border-b px-4", compact ? "justify-center" : "justify-between")}><Brand compact={compact} />{!mobile && !compact && <Button variant="ghost" size="icon" className="size-8" aria-label="Collapse sidebar" onClick={toggleSidebar}><ChevronLeft className="size-4" /></Button>}</div><div className="p-3"><div aria-label={`Current workspace: ${workspaceName}`} className={cn("flex w-full items-center gap-3 rounded-lg border bg-card p-2 text-left shadow-sm", compact && "justify-center border-transparent bg-transparent shadow-none")}><span className="grid size-8 shrink-0 place-items-center rounded-md bg-foreground text-xs font-semibold text-background">{workspaceInitials}</span>{!compact && <><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{workspaceName}</span><span className="block text-xs text-muted-foreground">Business workspace</span></span><Building2 className="size-4 text-muted-foreground" aria-hidden="true" /></>}</div></div><nav aria-label="Primary navigation" className="flex-1 space-y-1 overflow-y-auto px-3 py-2">{nav.map(({ label, href, icon: Icon }) => { const active = path === href || path.startsWith(`${href}/`); return <Link key={href} href={href} title={compact ? label : undefined} onClick={() => mobile && setMobileOpen(false)} className={cn("flex h-10 items-center gap-3 rounded-lg px-3 text-sm text-muted-foreground outline-none transition hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring", active && "bg-accent font-medium text-accent-foreground", compact && "justify-center px-0")}><Icon className="size-[18px] shrink-0" /><AnimatePresence initial={false}>{!compact && <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>{label}</motion.span>}</AnimatePresence></Link>; })}</nav><div className="border-t p-3"><Link href="/settings" className={cn("flex h-10 items-center gap-3 rounded-lg px-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground", compact && "justify-center px-0")}><Settings className="size-[18px]" />{!compact && "Settings"}</Link></div></div>;
}

export function DesktopSidebar() { const { sidebarCollapsed, toggleSidebar } = useUIStore(); return <motion.aside animate={{ width: sidebarCollapsed ? 72 : 248 }} transition={{ duration: .2, ease: "easeOut" }} className="fixed inset-y-0 left-0 z-30 hidden border-r bg-background lg:block"><SidebarContent />{sidebarCollapsed && <Button variant="outline" size="icon" className="absolute -right-3 top-6 size-6 rounded-full bg-card" aria-label="Expand sidebar" onClick={toggleSidebar}><ChevronLeft className="size-3 rotate-180" /></Button>}</motion.aside>; }
