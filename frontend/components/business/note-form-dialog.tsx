"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bold, Italic, List, LoaderCircle } from "lucide-react";
import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SelectControl } from "@/components/business/shared";
import { businessApi, businessKeys } from "@/lib/api/business";
import { documentsApi } from "@/lib/api/documents";
import type { Note, NoteInput } from "@/lib/types/business";
import { workspaceNoteSchema, type WorkspaceNoteValues } from "@/lib/validations/business";

type Props = { open: boolean; onOpenChange: (open: boolean) => void; note?: Note | null; projectId?: string; taskId?: string; employeeId?: string; customerId?: string; documentId?: string; };

export function NoteFormDialog({ open, onOpenChange, note, projectId, taskId, employeeId, customerId, documentId }: Props) {
  const queryClient = useQueryClient();
  const form = useForm<WorkspaceNoteValues>({ resolver: zodResolver(workspaceNoteSchema), defaultValues: initialValues(note, { projectId, taskId, employeeId, customerId, documentId }) });
  useEffect(() => { if (open) form.reset(initialValues(note, { projectId, taskId, employeeId, customerId, documentId })); }, [customerId, documentId, employeeId, form, note, open, projectId, taskId]);
  const relationType = useWatch({ control: form.control, name: "relation_type" });
  const projects = useQuery({ queryKey: [...businessKeys.projects, "note-options"], queryFn: () => businessApi.projects.list({}, 0, 100), enabled: open });
  const tasks = useQuery({ queryKey: [...businessKeys.tasks, "note-options"], queryFn: () => businessApi.tasks.list({}, 0, 100), enabled: open });
  const employees = useQuery({ queryKey: [...businessKeys.employees, "note-options"], queryFn: () => businessApi.employees.list({}, 0, 100), enabled: open });
  const customers = useQuery({ queryKey: [...businessKeys.customers, "note-options"], queryFn: () => businessApi.customers.list({}, 0, 100), enabled: open, retry: false });
  const documents = useQuery({ queryKey: ["documents", "note-options"], queryFn: () => documentsApi.list({ limit: 100 }), enabled: open });
  const tags = useQuery({ queryKey: businessKeys.tags, queryFn: () => businessApi.tags.list(100), enabled: open });
  const mutation = useMutation({
    mutationFn: (values: WorkspaceNoteValues) => note ? businessApi.notes.update(note.id, { title: values.title, body: values.body, tag_ids: values.tag_ids }) : businessApi.notes.create(toInput(values)),
    onSuccess: async () => { await Promise.all([queryClient.invalidateQueries({ queryKey: businessKeys.notes }), queryClient.invalidateQueries({ queryKey: businessKeys.tags })]); toast.success(note ? "Note updated" : "Note created"); onOpenChange(false); },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Note could not be saved"),
  });
  const append = (syntax: string) => { const current = form.getValues("body"); form.setValue("body", `${current}${current ? "\n" : ""}${syntax}`, { shouldDirty: true, shouldValidate: true }); };
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[calc(100dvh-2rem)] max-w-3xl overflow-y-auto"><DialogTitle className="text-lg font-semibold">{note ? "Edit note" : "Create note"}</DialogTitle><DialogDescription className="text-sm text-muted-foreground">Capture durable context with Markdown formatting, reusable tags, and an optional business relationship.</DialogDescription><form className="mt-5 space-y-5" onSubmit={form.handleSubmit((values) => mutation.mutate(values))} noValidate>
    <div className="grid gap-4 sm:grid-cols-2"><Field id="note-scope" label="Visibility" error={form.formState.errors.scope?.message}><SelectControl id="note-scope" className="w-full" disabled={Boolean(note)} {...form.register("scope")}><option value="personal">Personal</option><option value="company">Company</option><option value="project">Project</option></SelectControl></Field><Field id="note-relation-type" label="Related entity" error={form.formState.errors.relation_type?.message}><SelectControl id="note-relation-type" className="w-full" disabled={Boolean(note)} {...form.register("relation_type")}><option value="none">No relationship</option><option value="employee">Employee</option><option value="customer">Customer</option><option value="project">Project</option><option value="task">Task</option><option value="document">Document</option></SelectControl></Field></div>
    {relationType !== "none" && <Field id="note-relation-record" label="Related record" error={form.formState.errors.relation_id?.message}><SelectControl id="note-relation-record" className="w-full" disabled={Boolean(note)} {...form.register("relation_id")}><option value="">Choose a record</option>{relationOptions(relationType, { projects: projects.data?.items ?? [], tasks: tasks.data?.items ?? [], employees: employees.data?.items ?? [], customers: customers.data?.items ?? [], documents: documents.data?.items ?? [] }).map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</SelectControl></Field>}
    <Field id="note-title" label="Title" error={form.formState.errors.title?.message}><Input id="note-title" autoFocus {...form.register("title")} /></Field><div className="space-y-2"><div className="flex flex-wrap items-center justify-between gap-2"><Label htmlFor="note-body">Note</Label><div className="flex rounded-lg border bg-muted/30 p-1" aria-label="Markdown formatting"><Button type="button" variant="ghost" size="icon" className="size-8" aria-label="Insert bold text" onClick={() => append("**bold text**")}><Bold className="size-4" /></Button><Button type="button" variant="ghost" size="icon" className="size-8" aria-label="Insert italic text" onClick={() => append("_italic text_")}><Italic className="size-4" /></Button><Button type="button" variant="ghost" size="icon" className="size-8" aria-label="Insert bullet list" onClick={() => append("- List item")}><List className="size-4" /></Button></div></div><Textarea id="note-body" rows={10} placeholder="Write with Markdown…" {...form.register("body")} />{form.formState.errors.body && <p role="alert" className="text-xs text-destructive">{form.formState.errors.body.message}</p>}</div>
    <fieldset><legend className="mb-2 text-sm font-medium">Tags</legend><div className="flex flex-wrap gap-2">{(tags.data?.items ?? []).map((tag) => <label key={tag.id} className="inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-xs"><input type="checkbox" value={tag.id} {...form.register("tag_ids")} /><span className="size-2 rounded-full" style={{ backgroundColor: tag.color ?? "var(--primary)" }} />{tag.name}</label>)}</div></fieldset>
    <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end"><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button disabled={mutation.isPending}>{mutation.isPending && <LoaderCircle className="size-4 animate-spin" />}{note ? "Save changes" : "Create note"}</Button></div>
  </form></DialogContent></Dialog>;
}

function toInput(values: WorkspaceNoteValues): NoteInput {
  const input: NoteInput = { scope: values.scope, title: values.title, body: values.body, tag_ids: values.tag_ids };
  if (values.relation_type !== "none" && values.relation_id) input[`${values.relation_type}_id` as "employee_id" | "customer_id" | "project_id" | "task_id" | "document_id"] = values.relation_id;
  return input;
}

function initialValues(note: Note | null | undefined, defaults: Omit<Props, "open" | "onOpenChange" | "note">): WorkspaceNoteValues {
  const relationship = note ? relationOf(note) : defaults.taskId ? ["task", defaults.taskId] : defaults.projectId ? ["project", defaults.projectId] : defaults.employeeId ? ["employee", defaults.employeeId] : defaults.customerId ? ["customer", defaults.customerId] : defaults.documentId ? ["document", defaults.documentId] : ["none", ""];
  const defaultScope = relationship[0] === "project" || relationship[0] === "task" ? "project" : relationship[0] === "customer" ? "company" : "personal";
  return { scope: note?.scope ?? defaultScope, title: note?.title ?? "", body: note?.body ?? "", relation_type: relationship[0] as WorkspaceNoteValues["relation_type"], relation_id: relationship[1], tag_ids: note?.tags.map((tag) => tag.id) ?? [] };
}

function relationOf(note: Note): [WorkspaceNoteValues["relation_type"], string] { if (note.task_id) return ["task", note.task_id]; if (note.customer_id) return ["customer", note.customer_id]; if (note.employee_id) return ["employee", note.employee_id]; if (note.document_id) return ["document", note.document_id]; if (note.project_id) return ["project", note.project_id]; return ["none", ""]; }
function relationOptions(type: WorkspaceNoteValues["relation_type"], data: { projects: Array<{ id: string; name: string }>; tasks: Array<{ id: string; title: string }>; employees: Array<{ id: string; first_name: string; last_name: string }>; customers: Array<{ id: string; name: string }>; documents: Array<{ id: string; title: string }>; }) { if (type === "project") return data.projects.map((item) => ({ id: item.id, label: item.name })); if (type === "task") return data.tasks.map((item) => ({ id: item.id, label: item.title })); if (type === "employee") return data.employees.map((item) => ({ id: item.id, label: `${item.first_name} ${item.last_name}` })); if (type === "customer") return data.customers.map((item) => ({ id: item.id, label: item.name })); if (type === "document") return data.documents.map((item) => ({ id: item.id, label: item.title })); return []; }
function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: React.ReactNode }) { return <div className="space-y-2"><Label htmlFor={id}>{label}</Label>{children}{error && <p role="alert" className="text-xs text-destructive">{error}</p>}</div>; }
