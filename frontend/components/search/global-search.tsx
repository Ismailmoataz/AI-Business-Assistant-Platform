"use client";

import { useQuery } from "@tanstack/react-query";
import { Building2, Command, FileText, FolderKanban, ListTodo, Search, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { SearchInput } from "@/components/ui/search-input";
import { Skeleton } from "@/components/ui/skeleton";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { businessApi, businessKeys } from "@/lib/api/business";

type Result = { id: string; type: "Employee" | "Customer" | "Project" | "Task" | "Note"; title: string; description: string; href: string };
export const OPEN_GLOBAL_SEARCH_EVENT = "orbit:open-global-search";

export function GlobalSearch() {
  const router = useRouter(); const [open, setOpen] = useState(false); const [search, setSearch] = useState(""); const query = useDebouncedValue(search.trim());
  const desktopTriggerRef = useRef<HTMLButtonElement>(null); const mobileTriggerRef = useRef<HTMLButtonElement>(null); const returnFocusRef = useRef<HTMLElement | null>(null);
  const openSearch = (trigger?: HTMLElement | null) => { returnFocusRef.current = trigger ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null); setOpen(true); };
  useEffect(() => {
    const openFromCurrentFocus = () => { returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; setOpen(true); };
    const onKeyDown = (event: KeyboardEvent) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); openFromCurrentFocus(); } };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener(OPEN_GLOBAL_SEARCH_EVENT, openFromCurrentFocus);
    return () => { window.removeEventListener("keydown", onKeyDown); window.removeEventListener(OPEN_GLOBAL_SEARCH_EVENT, openFromCurrentFocus); };
  }, []);
  const resultsQuery = useQuery({ queryKey: [...businessKeys.globalSearch, query], enabled: open && query.length >= 2, queryFn: async () => {
    const settled = await Promise.allSettled([businessApi.employees.list({ search: query }, 0, 6), businessApi.customers.list({ search: query }, 0, 6), businessApi.projects.list({ search: query }, 0, 6), businessApi.tasks.list({ search: query }, 0, 6), businessApi.notes.list({ search: query }, 0, 6)]);
    const employees = settled[0].status === "fulfilled" ? settled[0].value.items : [];
    const customers = settled[1].status === "fulfilled" ? settled[1].value.items : [];
    const projects = settled[2].status === "fulfilled" ? settled[2].value.items : [];
    const tasks = settled[3].status === "fulfilled" ? settled[3].value.items : [];
    const notes = settled[4].status === "fulfilled" ? settled[4].value.items : [];
    return [
      ...employees.map((item) => ({ id: item.id, type: "Employee" as const, title: `${item.first_name} ${item.last_name}`, description: item.job_title ?? item.email, href: `/employees/${item.id}` })),
      ...customers.map((item) => ({ id: item.id, type: "Customer" as const, title: item.name, description: item.contact_name ?? item.email ?? "Customer", href: `/customers/${item.id}` })),
      ...projects.map((item) => ({ id: item.id, type: "Project" as const, title: item.name, description: item.description ?? "Project", href: `/projects/${item.id}` })),
      ...tasks.map((item) => ({ id: item.id, type: "Task" as const, title: item.title, description: item.description ?? "Task", href: `/tasks/${item.id}` })),
      ...notes.map((item) => ({ id: item.id, type: "Note" as const, title: item.title, description: item.body, href: `/notes/${item.id}` })),
    ] satisfies Result[];
  }});
  const groups = useMemo(() => { const grouped = new Map<Result["type"], Result[]>(); for (const result of resultsQuery.data ?? []) grouped.set(result.type, [...(grouped.get(result.type) ?? []), result]); return grouped; }, [resultsQuery.data]);
  const choose = (href: string) => { setOpen(false); setSearch(""); router.push(href); };
  return <><button ref={desktopTriggerRef} type="button" onClick={(event) => openSearch(event.currentTarget)} className="hidden h-9 w-full max-w-md items-center gap-2 rounded-lg border bg-card px-3 text-sm text-muted-foreground shadow-sm transition hover:border-input hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex"><Search className="size-4" /><span>Search anything…</span><kbd className="ml-auto flex items-center gap-1 rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px]"><Command className="size-2.5" />K</kbd></button><button ref={mobileTriggerRef} type="button" onClick={(event) => openSearch(event.currentTarget)} className="grid size-9 place-items-center rounded-lg text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:hidden" aria-label="Search workspace"><Search className="size-[18px]" /></button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent onCloseAutoFocus={(event) => { event.preventDefault(); (returnFocusRef.current ?? desktopTriggerRef.current ?? mobileTriggerRef.current)?.focus(); }} className="top-[min(42%,24rem)] max-h-[min(80dvh,42rem)] max-w-2xl overflow-hidden p-0"><div className="border-b p-4"><DialogTitle className="sr-only">Search workspace</DialogTitle><DialogDescription className="sr-only">Search employees, customers, projects, tasks, and notes.</DialogDescription><SearchInput autoFocus value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search employees, customers, projects, tasks, and notes…" aria-label="Search workspace" /></div><div className="max-h-[min(62dvh,32rem)] overflow-y-auto p-3" aria-live="polite">{query.length < 2 ? <p className="p-8 text-center text-sm text-muted-foreground">Enter at least two characters to search the workspace.</p> : resultsQuery.isLoading ? <div className="space-y-2" role="status" aria-label="Searching"><Skeleton className="h-14" /><Skeleton className="h-14" /><Skeleton className="h-14" /></div> : !resultsQuery.data?.length ? <p className="p-8 text-center text-sm text-muted-foreground">No workspace results found.</p> : [...groups.entries()].map(([type, items]) => <section key={type} className="mb-4 last:mb-0" aria-labelledby={`search-${type}`}><h2 id={`search-${type}`} className="px-2 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{type}s</h2><div className="space-y-1">{items.map((item) => <button key={`${item.type}-${item.id}`} type="button" onClick={() => choose(item.href)} className="flex w-full min-w-0 items-center gap-3 rounded-lg p-2.5 text-left outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground">{iconFor(item.type)}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{item.title}</span><span className="block truncate text-xs text-muted-foreground">{item.description}</span></span></button>)}</div></section>)}</div></DialogContent></Dialog>
  </>;
}

function iconFor(type: Result["type"]) { const Icon = type === "Employee" ? UserRound : type === "Customer" ? Building2 : type === "Project" ? FolderKanban : type === "Task" ? ListTodo : FileText; return <Icon className="size-4" />; }
