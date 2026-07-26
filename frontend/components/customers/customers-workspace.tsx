"use client";

import { useQuery } from "@tanstack/react-query";
import { Building2, Grid2X2, LayoutList, Mail, Plus, SearchX, UserRound, UsersRound } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { CustomerFormDialog } from "@/components/business/customer-form-dialog";
import { CUSTOMER_STATUSES, CustomerStatusBadge, SelectControl, TagPills, customerStatusLabel } from "@/components/business/shared";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
import { Skeleton } from "@/components/ui/skeleton";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useProtectedRoute } from "@/hooks/use-protected-route";
import { businessApi, businessKeys } from "@/lib/api/business";
import type { Customer, CustomerFilters, CustomerSort } from "@/lib/types/business";

const PAGE_SIZE = 24;

export function CustomersWorkspace() {
  const { ready, user } = useProtectedRoute();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search.trim());
  const [status, setStatus] = useState<CustomerFilters["status"]>("all");
  const [customerType, setCustomerType] = useState<CustomerFilters["customerType"]>("all");
  const [tagId, setTagId] = useState("");
  const [sort, setSort] = useState<CustomerSort>("name");
  const [view, setView] = useState<"grid" | "table">("grid");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const filters = useMemo<CustomerFilters>(() => ({ search: debouncedSearch || undefined, status, customerType, tagId: tagId || undefined, sort }), [customerType, debouncedSearch, sort, status, tagId]);
  const customersQuery = useQuery({ queryKey: [...businessKeys.customers, "directory", filters, page], queryFn: () => businessApi.customers.list(filters, (page - 1) * PAGE_SIZE, PAGE_SIZE), enabled: ready, retry: false });
  const tagsQuery = useQuery({ queryKey: businessKeys.tags, queryFn: () => businessApi.tags.list(100), enabled: ready });
  const customers = customersQuery.data?.items ?? [];
  const pages = Math.max(1, Math.ceil((customersQuery.data?.page.total ?? 0) / PAGE_SIZE));
  const canManage = user?.role !== "employee";
  const activeFilters = status !== "all" || customerType !== "all" || Boolean(tagId);
  const resetPage = <T,>(setter: (value: T) => void, value: T) => { setter(value); setPage(1); };
  if (!ready) return <DirectorySkeleton />;
  return <div className="min-w-0 space-y-6"><header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="text-2xl font-semibold tracking-[-.03em] sm:text-3xl">Customers</h1><p className="mt-1 text-sm text-muted-foreground">A relationship-first view of customers, contacts, and shared work.</p></div>{canManage && <Button onClick={() => setCreateOpen(true)}><Plus className="size-4" />New customer</Button>}</header>
    <section aria-label="Customer search and filters" className="space-y-3 rounded-xl border bg-card p-3 shadow-card"><div className="flex flex-col gap-2 lg:flex-row"><SearchInput value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search customers or contacts…" aria-label="Search customers" className="min-w-0 flex-1" /><div className="flex flex-wrap gap-2"><SelectControl aria-label="Filter by customer type" value={customerType} onChange={(event) => resetPage(setCustomerType, event.target.value as CustomerFilters["customerType"])}><option value="all">All types</option><option value="company">Companies</option><option value="individual">Individuals</option></SelectControl><SelectControl aria-label="Filter by customer status" value={status} onChange={(event) => resetPage(setStatus, event.target.value as CustomerFilters["status"])}><option value="all">All statuses</option>{CUSTOMER_STATUSES.map((item) => <option key={item} value={item}>{customerStatusLabel[item]}</option>)}</SelectControl><SelectControl aria-label="Filter by tag" value={tagId} onChange={(event) => resetPage(setTagId, event.target.value)}><option value="">All tags</option>{(tagsQuery.data?.items ?? []).map((tag) => <option key={tag.id} value={tag.id}>{tag.name}</option>)}</SelectControl></div></div><div className="flex flex-wrap items-center gap-2"><SelectControl aria-label="Sort customers" value={sort} onChange={(event) => resetPage(setSort, event.target.value as CustomerSort)}><option value="name">Name</option><option value="status">Status</option><option value="updated">Recently updated</option></SelectControl>{activeFilters && <Button variant="ghost" size="sm" onClick={() => { setStatus("all"); setCustomerType("all"); setTagId(""); setPage(1); }}>Clear filters</Button>}<span className="ml-auto text-xs text-muted-foreground">{customersQuery.data?.page.total ?? 0} customers</span><div className="flex rounded-lg border bg-background p-0.5"><Button variant={view === "grid" ? "secondary" : "ghost"} size="icon" className="size-8" aria-label="Customer grid view" onClick={() => setView("grid")}><Grid2X2 className="size-4" /></Button><Button variant={view === "table" ? "secondary" : "ghost"} size="icon" className="size-8" aria-label="Customer table view" onClick={() => setView("table")}><LayoutList className="size-4" /></Button></div></div></section>
    {customersQuery.isLoading ? <DirectorySkeleton compact /> : customersQuery.isError ? <ErrorState title="Customers could not be loaded" description={canManage ? undefined : "Customer records are available to managers and administrators."} retry={() => void customersQuery.refetch()} /> : !customers.length ? <EmptyState icon={search || activeFilters ? SearchX : UsersRound} title="No matching customers" description="Try another search or clear the active filters." action={canManage ? { label: "Create customer", onClick: () => setCreateOpen(true) } : undefined} /> : view === "grid" ? <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{customers.map((customer) => <CustomerCard key={customer.id} customer={customer} />)}</div> : <CustomerTable customers={customers} />}
    {customersQuery.data && pages > 1 && <Pagination page={page} pages={pages} onPageChange={setPage} />}
    <CustomerFormDialog open={createOpen} onOpenChange={setCreateOpen} tags={tagsQuery.data?.items ?? []} />
  </div>;
}

function CustomerCard({ customer }: { customer: Customer }) { const Icon = customer.customer_type === "company" ? Building2 : UserRound; return <article className="min-w-0 rounded-xl border bg-card p-5 shadow-card"><div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground"><Icon className="size-5" /></span><div className="min-w-0 flex-1"><Link href={`/customers/${customer.id}`} className="block truncate rounded-sm font-semibold outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring">{customer.name}</Link><p className="truncate text-sm text-muted-foreground">{customer.contact_name ?? (customer.customer_type === "company" ? "No primary contact" : "Individual")}</p></div><CustomerStatusBadge status={customer.status} /></div><div className="mt-4 border-t pt-4"><p className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground"><Mail className="size-3.5 shrink-0" /><span className="truncate">{customer.email ?? "No email"}</span></p><div className="mt-3"><TagPills tags={customer.tags} limit={4} /></div></div></article>; }
function CustomerTable({ customers }: { customers: Customer[] }) { return <><div className="space-y-3 md:hidden">{customers.map((customer) => <CustomerCard key={customer.id} customer={customer} />)}</div><div className="hidden overflow-hidden rounded-xl border bg-card shadow-card md:block"><div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead className="border-b bg-muted/45 text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-4 py-3 font-medium">Customer</th><th className="px-3 py-3 font-medium">Contact</th><th className="px-3 py-3 font-medium">Type</th><th className="px-3 py-3 font-medium">Status</th><th className="px-3 py-3 font-medium">Tags</th></tr></thead><tbody>{customers.map((customer) => <tr key={customer.id} className="border-b last:border-0 hover:bg-muted/40"><td className="px-4 py-4"><Link href={`/customers/${customer.id}`} className="font-medium hover:text-primary hover:underline">{customer.name}</Link><p className="text-xs text-muted-foreground">{customer.email ?? "No email"}</p></td><td className="px-3 py-4">{customer.contact_name ?? "—"}</td><td className="px-3 py-4 capitalize">{customer.customer_type}</td><td className="px-3 py-4"><CustomerStatusBadge status={customer.status} /></td><td className="px-3 py-4"><TagPills tags={customer.tags} limit={3} /></td></tr>)}</tbody></table></div></div></>; }
function DirectorySkeleton({ compact = false }: { compact?: boolean }) { return <div className="space-y-5" role="status" aria-label="Loading customers">{!compact && <Skeleton className="h-10 w-52" />}<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-48 rounded-xl" />)}</div></div>; }
