"use client";

import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { LoaderCircle } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PROJECT_STATUSES, SelectControl, projectStatusLabel } from "@/components/business/shared";
import { businessApi, businessKeys } from "@/lib/api/business";
import { projectSchema, type ProjectValues } from "@/lib/validations/business";
import type { Employee, Project, ProjectInput, Tag } from "@/lib/types/business";

const emptyProject: ProjectValues = { name: "", description: "", status: "planning", owner_id: "", customer_id: "", start_date: "", end_date: "", tag_ids: [] };

export function ProjectFormDialog({ open, onOpenChange, project, employees, tags, defaultCustomerId }: { open: boolean; onOpenChange: (open: boolean) => void; project?: Project | null; employees: Employee[]; tags: Tag[]; defaultCustomerId?: string }) {
  const queryClient = useQueryClient();
  const form = useForm<ProjectValues>({ resolver: zodResolver(projectSchema), defaultValues: emptyProject });
  useEffect(() => {
    if (!open) return;
    form.reset(project ? { name: project.name, description: project.description ?? "", status: project.status, owner_id: project.owner_id, customer_id: project.customer_id ?? "", start_date: project.start_date ?? "", end_date: project.end_date ?? "", tag_ids: project.tags.map((tag) => tag.id) } : { ...emptyProject, customer_id: defaultCustomerId ?? "" });
  }, [defaultCustomerId, form, open, project]);
  const mutation = useMutation({
    mutationFn: (input: ProjectInput) => project ? businessApi.projects.update(project.id, input) : businessApi.projects.create(input),
    onSuccess: async (saved) => {
      queryClient.setQueryData(businessKeys.project(saved.id), saved);
      await queryClient.invalidateQueries({ queryKey: businessKeys.projects });
      toast.success(project ? "Project updated" : "Project created");
      onOpenChange(false);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Project could not be saved"),
  });
  const submit = (values: ProjectValues) => mutation.mutate({
    name: values.name,
    description: values.description || null,
    status: values.status,
    owner_id: values.owner_id || null,
    customer_id: values.customer_id || null,
    start_date: values.start_date || null,
    end_date: values.end_date || null,
    tag_ids: values.tag_ids,
  });
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[calc(100dvh-2rem)] max-w-2xl overflow-y-auto"><DialogTitle className="text-lg font-semibold">{project ? "Edit project" : "Create project"}</DialogTitle><DialogDescription className="text-sm text-muted-foreground">Set ownership, dates, status, and labels for this workspace project.</DialogDescription><form className="mt-5 space-y-5" onSubmit={form.handleSubmit(submit)} noValidate>
    <Field id="project-name" label="Project name" error={form.formState.errors.name?.message}><Input id="project-name" autoFocus {...form.register("name")} /></Field>
    <Field id="project-description" label="Description" error={form.formState.errors.description?.message}><Textarea id="project-description" placeholder="What is this project expected to deliver?" {...form.register("description")} /></Field>
    <div className="grid gap-4 sm:grid-cols-2"><Field id="project-status" label="Status"><SelectControl id="project-status" className="w-full" {...form.register("status")}>{PROJECT_STATUSES.map((status) => <option key={status} value={status}>{projectStatusLabel[status]}</option>)}</SelectControl></Field><Field id="project-owner" label="Owner"><SelectControl id="project-owner" className="w-full" {...form.register("owner_id")}><option value="">Current user</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.first_name} {employee.last_name}</option>)}</SelectControl></Field></div>
    <div className="grid gap-4 sm:grid-cols-2"><Field id="project-start" label="Start date"><Input id="project-start" type="date" {...form.register("start_date")} /></Field><Field id="project-end" label="Due date" error={form.formState.errors.end_date?.message}><Input id="project-end" type="date" {...form.register("end_date")} /></Field></div>
    <fieldset><legend className="text-sm font-medium">Tags</legend><div className="mt-2 flex max-h-32 flex-wrap gap-2 overflow-y-auto rounded-lg border p-3">{tags.length ? tags.map((tag) => <label key={tag.id} className="flex cursor-pointer items-center gap-2 rounded-md border bg-card px-2.5 py-1.5 text-xs"><input type="checkbox" value={tag.id} className="accent-primary" {...form.register("tag_ids")} /><span className="size-2 rounded-full" style={{ backgroundColor: tag.color ?? "var(--primary)" }} />{tag.name}</label>) : <span className="text-xs text-muted-foreground">No workspace tags available.</span>}</div></fieldset>
    <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end"><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button disabled={mutation.isPending}>{mutation.isPending && <LoaderCircle className="size-4 animate-spin" />}{project ? "Save changes" : "Create project"}</Button></div>
  </form></DialogContent></Dialog>;
}

function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: React.ReactNode }) { return <div className="space-y-2"><Label htmlFor={id}>{label}</Label>{children}{error && <p className="text-xs text-destructive" role="alert">{error}</p>}</div>; }
