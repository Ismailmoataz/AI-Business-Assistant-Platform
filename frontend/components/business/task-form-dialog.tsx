"use client";

import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { LoaderCircle } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { TASK_PRIORITIES, TASK_STATUSES, SelectControl, priorityLabel, taskStatusLabel } from "@/components/business/shared";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { businessApi, businessKeys } from "@/lib/api/business";
import type { UserRole } from "@/lib/types/api";
import type { Employee, Project, Tag, Task, TaskCreateInput, TaskUpdateInput } from "@/lib/types/business";
import { taskSchema, type TaskValues } from "@/lib/validations/business";

const emptyTask: TaskValues = { project_id: "", title: "", description: "", assignee_id: "", status: "todo", priority: "medium", progress: 0, due_date: "", tag_ids: [] };

export function TaskFormDialog({ open, onOpenChange, task, defaultProjectId, projects, employees, tags, role }: { open: boolean; onOpenChange: (open: boolean) => void; task?: Task | null; defaultProjectId?: string; projects: Project[]; employees: Employee[]; tags: Tag[]; role: UserRole }) {
  const queryClient = useQueryClient();
  const employeeMode = role === "employee" && Boolean(task);
  const form = useForm<TaskValues>({ resolver: zodResolver(taskSchema), defaultValues: emptyTask });
  const progress = useWatch({ control: form.control, name: "progress" });
  useEffect(() => {
    if (!open) return;
    form.reset(task ? { project_id: task.project_id, title: task.title, description: task.description ?? "", assignee_id: task.assignee_id ?? "", status: task.status, priority: task.priority, progress: task.progress, due_date: task.due_date ?? "", tag_ids: task.tags.map((tag) => tag.id) } : { ...emptyTask, project_id: defaultProjectId ?? "" });
  }, [defaultProjectId, form, open, task]);
  const mutation = useMutation({
    mutationFn: (input: TaskCreateInput | TaskUpdateInput) => task ? businessApi.tasks.update(task.id, input as TaskUpdateInput) : businessApi.tasks.create(input as TaskCreateInput),
    onSuccess: async (saved) => {
      await Promise.all([queryClient.invalidateQueries({ queryKey: businessKeys.tasks }), queryClient.invalidateQueries({ queryKey: businessKeys.task(saved.id) }), queryClient.invalidateQueries({ queryKey: businessKeys.projects })]);
      toast.success(task ? "Task updated" : "Task created");
      onOpenChange(false);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Task could not be saved"),
  });
  const submit = (values: TaskValues) => {
    if (task && employeeMode) { mutation.mutate({ status: values.status, progress: values.progress }); return; }
    const input: TaskCreateInput = { project_id: values.project_id, title: values.title, description: values.description || null, assignee_id: values.assignee_id || null, status: values.status, priority: values.priority, progress: values.progress, due_date: values.due_date || null, tag_ids: values.tag_ids };
    if (task) { const { project_id: _, ...update } = input; void _; mutation.mutate(update); } else mutation.mutate(input);
  };
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[calc(100dvh-2rem)] max-w-2xl overflow-y-auto"><DialogTitle className="text-lg font-semibold">{task ? "Edit task" : "Create task"}</DialogTitle><DialogDescription className="text-sm text-muted-foreground">{employeeMode ? "Update the status and completion of your assigned work." : "Define the work, assignment, priority, due date, and workflow state."}</DialogDescription><form className="mt-5 space-y-5" onSubmit={form.handleSubmit(submit)} noValidate>
    {!employeeMode && <><Field id="task-project" label="Project" error={form.formState.errors.project_id?.message}><SelectControl id="task-project" className="w-full" disabled={Boolean(task)} {...form.register("project_id")}><option value="">Choose a project</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</SelectControl></Field><Field id="task-title" label="Task title" error={form.formState.errors.title?.message}><Input id="task-title" autoFocus {...form.register("title")} /></Field><Field id="task-description" label="Description" error={form.formState.errors.description?.message}><Textarea id="task-description" placeholder="Add acceptance criteria or useful context." {...form.register("description")} /></Field><div className="grid gap-4 sm:grid-cols-2"><Field id="task-assignee" label="Assignee"><SelectControl id="task-assignee" className="w-full" {...form.register("assignee_id")}><option value="">Unassigned</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.first_name} {employee.last_name}</option>)}</SelectControl></Field><Field id="task-priority" label="Priority"><SelectControl id="task-priority" className="w-full" {...form.register("priority")}>{TASK_PRIORITIES.map((priority) => <option key={priority} value={priority}>{priorityLabel[priority]}</option>)}</SelectControl></Field></div></>}
    <div className="grid gap-4 sm:grid-cols-2"><Field id="task-status" label="Status"><SelectControl id="task-status" className="w-full" {...form.register("status")}>{TASK_STATUSES.map((status) => <option key={status} value={status}>{taskStatusLabel[status]}</option>)}</SelectControl></Field>{!employeeMode && <Field id="task-due" label="Due date"><Input id="task-due" type="date" {...form.register("due_date")} /></Field>}</div>
    <Field id="task-progress" label="Progress" error={form.formState.errors.progress?.message}><div className="flex items-center gap-3"><input id="task-progress" type="range" min={0} max={100} step={5} value={progress} onChange={(event) => form.setValue("progress", Number(event.target.value), { shouldDirty: true, shouldValidate: true })} className="min-w-0 flex-1 accent-primary" /><Input aria-label="Progress percentage" type="number" min={0} max={100} className="w-24" {...form.register("progress", { valueAsNumber: true })} /></div></Field>
    {!employeeMode && <fieldset><legend className="text-sm font-medium">Tags</legend><div className="mt-2 flex max-h-32 flex-wrap gap-2 overflow-y-auto rounded-lg border p-3">{tags.length ? tags.map((tag) => <label key={tag.id} className="flex cursor-pointer items-center gap-2 rounded-md border bg-card px-2.5 py-1.5 text-xs"><input type="checkbox" value={tag.id} className="accent-primary" {...form.register("tag_ids")} /><span className="size-2 rounded-full" style={{ backgroundColor: tag.color ?? "var(--primary)" }} />{tag.name}</label>) : <span className="text-xs text-muted-foreground">No workspace tags available.</span>}</div></fieldset>}
    <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end"><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button disabled={mutation.isPending}>{mutation.isPending && <LoaderCircle className="size-4 animate-spin" />}{task ? "Save changes" : "Create task"}</Button></div>
  </form></DialogContent></Dialog>;
}

function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: React.ReactNode }) { return <div className="space-y-2"><Label htmlFor={id}>{label}</Label>{children}{error && <p className="text-xs text-destructive" role="alert">{error}</p>}</div>; }
