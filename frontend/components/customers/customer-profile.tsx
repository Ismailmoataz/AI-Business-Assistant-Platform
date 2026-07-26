"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, ArrowLeft, Building2, FileText, Mail, Pencil, Phone, Plus, Trash2, UserRound } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { CustomerFormDialog } from "@/components/business/customer-form-dialog";
import { NoteFormDialog } from "@/components/business/note-form-dialog";
import { ProjectFormDialog } from "@/components/business/project-form-dialog";
import { ActivityFeed, ConfirmDialog, CustomerStatusBadge, ProjectStatusBadge, TagPills, formatDate, relativeDate } from "@/components/business/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useProtectedRoute } from "@/hooks/use-protected-route";
import { ApiRequestError } from "@/lib/api/client";
import { businessApi, businessKeys } from "@/lib/api/business";
import { documentsApi } from "@/lib/api/documents";
import { toast } from "sonner";

export function CustomerProfile() {
  const { customerId } = useParams<{ customerId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { ready, user } = useProtectedRoute();
  const [editOpen, setEditOpen] = useState(false); const [noteOpen, setNoteOpen] = useState(false); const [projectOpen, setProjectOpen] = useState(false); const [deleteOpen, setDeleteOpen] = useState(false);
  const customerQuery = useQuery({ queryKey: businessKeys.customer(customerId), queryFn: () => businessApi.customers.get(customerId), enabled: ready, retry: false });
  const projectsQuery = useQuery({ queryKey: [...businessKeys.projects, "customer", customerId], queryFn: () => businessApi.projects.list({ customerId }, 0, 100), enabled: ready });
  const notesQuery = useQuery({ queryKey: [...businessKeys.notes, "customer", customerId], queryFn: () => businessApi.notes.list({ customerId }, 0, 50), enabled: ready });
  const documentsQuery = useQuery({ queryKey: ["documents", "customer", customerId], queryFn: () => documentsApi.list({ customerId, limit: 100 }), enabled: ready });
  const employeesQuery = useQuery({ queryKey: businessKeys.employees, queryFn: () => businessApi.employees.list({}, 0, 100), enabled: ready });
  const tagsQuery = useQuery({ queryKey: businessKeys.tags, queryFn: () => businessApi.tags.list(100), enabled: ready });
  const activityQuery = useQuery({ queryKey: [...businessKeys.activity, "customer", customerId], queryFn: () => businessApi.activity.list("customer", customerId), enabled: ready, retry: false });
  const customer = customerQuery.data; const employees = employeesQuery.data?.items ?? []; const canManage = user?.role !== "employee";
  const archiveMutation = useMutation({ mutationFn: () => businessApi.customers.update(customerId, { status: "inactive" }), onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: businessKeys.customers }); toast.success("Customer archived"); }, onError: (error) => toast.error(error instanceof Error ? error.message : "Customer could not be archived") });
  const removeMutation = useMutation({ mutationFn: () => businessApi.customers.remove(customerId), onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: businessKeys.customers }); toast.success("Customer deleted"); router.replace("/customers"); }, onError: (error) => toast.error(error instanceof Error ? error.message : "Customer could not be deleted") });
  const activityUnavailable = activityQuery.error instanceof ApiRequestError && activityQuery.error.status === 403;
  if (!ready || customerQuery.isLoading) return <ProfileSkeleton />;
  if (customerQuery.isError || !customer) return <ErrorState title="Customer unavailable" description="This customer may be outside your workspace access." retry={() => void customerQuery.refetch()} />;
  const Icon = customer.customer_type === "company" ? Building2 : UserRound;
  return <div className="min-w-0 space-y-6"><Link href="/customers" className="inline-flex items-center gap-2 rounded-md text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"><ArrowLeft className="size-4" />Back to customers</Link>
    <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><CustomerStatusBadge status={customer.status} /><span className="inline-flex items-center gap-1 text-xs capitalize text-muted-foreground"><Icon className="size-3.5" />{customer.customer_type}</span></div><h1 className="mt-3 break-words text-2xl font-semibold tracking-[-.03em] sm:text-3xl">{customer.name}</h1><TagPills tags={customer.tags} /></div>{canManage && <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => setEditOpen(true)}><Pencil className="size-4" />Edit</Button>{customer.status !== "inactive" && <Button variant="outline" disabled={archiveMutation.isPending} onClick={() => archiveMutation.mutate()}><Archive className="size-4" />Archive</Button>}<Button variant="ghost" size="icon" className="text-destructive" aria-label="Delete customer" onClick={() => setDeleteOpen(true)}><Trash2 className="size-4" /></Button></div>}</header>
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Customer contact information"><Metric label="Primary contact"><span>{customer.contact_name ?? "Not provided"}</span></Metric><Metric label="Email"><span className="flex min-w-0 items-center gap-2"><Mail className="size-4 shrink-0 text-muted-foreground" />{customer.email ? <a className="truncate text-primary hover:underline" href={`mailto:${customer.email}`}>{customer.email}</a> : "Not provided"}</span></Metric><Metric label="Phone"><span className="flex items-center gap-2"><Phone className="size-4 text-muted-foreground" />{customer.phone ?? "Not provided"}</span></Metric><Metric label="Relationship since"><span>{formatDate(customer.created_at.slice(0, 10))}</span></Metric></section>
    <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(19rem,.65fr)]"><div className="min-w-0 space-y-6"><Card><CardHeader className="flex-row items-center justify-between"><div><CardTitle>Linked projects</CardTitle><p className="mt-1 text-sm text-muted-foreground">Delivery work connected to this relationship</p></div>{canManage && <Button variant="outline" size="sm" onClick={() => setProjectOpen(true)}><Plus className="size-3.5" />Project</Button>}</CardHeader><CardContent>{projectsQuery.data?.items.length ? <div className="grid gap-3 sm:grid-cols-2">{projectsQuery.data.items.map((project) => <Link key={project.id} href={`/projects/${project.id}`} className="rounded-lg border p-4 outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"><div className="flex items-start justify-between gap-2"><p className="font-medium">{project.name}</p><ProjectStatusBadge status={project.status} /></div><p className="mt-3 text-xs text-muted-foreground">Due {formatDate(project.end_date)}</p></Link>)}</div> : <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">No linked projects.</p>}</CardContent></Card>
      <Card><CardHeader className="flex-row items-center justify-between"><div><CardTitle>Customer notes</CardTitle><p className="mt-1 text-sm text-muted-foreground">Relationship context and decisions</p></div><Button variant="outline" size="sm" onClick={() => setNoteOpen(true)}><Plus className="size-3.5" />Note</Button></CardHeader><CardContent>{customer.notes && <p className="mb-4 whitespace-pre-wrap rounded-lg bg-muted/50 p-4 text-sm">{customer.notes}</p>}{notesQuery.data?.items.length ? <div className="grid gap-3 sm:grid-cols-2">{notesQuery.data.items.map((note) => <Link key={note.id} href={`/notes/${note.id}`} className="rounded-lg border p-4 outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"><p className="font-medium">{note.title}</p><p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm text-muted-foreground">{note.body}</p><p className="mt-3 text-xs text-muted-foreground">Updated {relativeDate(note.updated_at)}</p></Link>)}</div> : !customer.notes && <p className="text-sm text-muted-foreground">No customer notes yet.</p>}</CardContent></Card></div>
      <aside className="min-w-0 space-y-6"><Card><CardHeader><CardTitle>Documents</CardTitle><p className="text-sm text-muted-foreground">Files linked to this customer</p></CardHeader><CardContent>{documentsQuery.data?.items.length ? <ul className="space-y-2">{documentsQuery.data.items.map((document) => <li key={document.id} className="flex min-w-0 items-center gap-2 rounded-lg border p-3"><FileText className="size-4 shrink-0 text-primary" /><span className="truncate text-sm">{document.title}</span></li>)}</ul> : <p className="text-sm text-muted-foreground">No linked documents.</p>}</CardContent></Card><Card><CardHeader><CardTitle>Recent activity</CardTitle></CardHeader><CardContent><ActivityFeed items={activityQuery.data?.items} employees={employees} loading={activityQuery.isLoading} unavailable={activityUnavailable} /></CardContent></Card></aside></div>
    <CustomerFormDialog open={editOpen} onOpenChange={setEditOpen} customer={customer} tags={tagsQuery.data?.items ?? []} /><NoteFormDialog open={noteOpen} onOpenChange={setNoteOpen} customerId={customer.id} /><ProjectFormDialog open={projectOpen} onOpenChange={setProjectOpen} employees={employees} tags={tagsQuery.data?.items ?? []} defaultCustomerId={customer.id} />
    <ConfirmDialog open={deleteOpen} onOpenChange={setDeleteOpen} title="Delete this customer?" description="The customer will leave active CRM views. Its retained audit history remains tenant-scoped." pending={removeMutation.isPending} onConfirm={() => removeMutation.mutate()} />
  </div>;
}

function Metric({ label, children }: { label: string; children: React.ReactNode }) { return <Card><CardContent className="p-4"><p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p><div className="min-w-0 text-sm">{children}</div></CardContent></Card>; }
function ProfileSkeleton() { return <div className="space-y-6" role="status" aria-label="Loading customer profile"><Skeleton className="h-6 w-36" /><Skeleton className="h-28" /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-24" />)}</div><Skeleton className="h-96" /></div>; }
