"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { LoaderCircle } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectControl, EMPLOYMENT_STATUSES, employmentStatusLabel } from "@/components/business/shared";
import { businessApi, businessKeys } from "@/lib/api/business";
import type { Department, Employee } from "@/lib/types/business";
import { employeeSchema, type EmployeeValues } from "@/lib/validations/business";

export function EmployeeFormDialog({ open, onOpenChange, employee, departments, managers, canManage }: { open: boolean; onOpenChange: (open: boolean) => void; employee: Employee; departments: Department[]; managers: Employee[]; canManage: boolean }) {
  const queryClient = useQueryClient();
  const form = useForm<EmployeeValues>({ resolver: zodResolver(employeeSchema), defaultValues: values(employee) });
  useEffect(() => { if (open) form.reset(values(employee)); }, [employee, form, open]);
  const mutation = useMutation({
    mutationFn: (input: EmployeeValues) => businessApi.employees.update(employee.id, {
      first_name: input.first_name,
      last_name: input.last_name,
      job_title: input.job_title || null,
      phone: input.phone || null,
      hire_date: input.hire_date || null,
      ...(canManage ? { department_id: input.department_id || null, manager_id: input.manager_id || null, employment_status: input.employment_status } : {}),
    }),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: businessKeys.employees }); toast.success("Employee profile updated"); onOpenChange(false); },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Employee profile could not be updated"),
  });
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[calc(100dvh-2rem)] max-w-2xl overflow-y-auto"><DialogTitle className="text-lg font-semibold">Edit employee profile</DialogTitle><DialogDescription className="text-sm text-muted-foreground">Update contact and organizational information within your permission scope.</DialogDescription><form className="mt-5 space-y-5" onSubmit={form.handleSubmit((input) => mutation.mutate(input))} noValidate>
    <div className="grid gap-4 sm:grid-cols-2"><Field id="employee-first-name" label="First name" error={form.formState.errors.first_name?.message}><Input id="employee-first-name" autoFocus {...form.register("first_name")} /></Field><Field id="employee-last-name" label="Last name" error={form.formState.errors.last_name?.message}><Input id="employee-last-name" {...form.register("last_name")} /></Field><Field id="employee-job-title" label="Job title" error={form.formState.errors.job_title?.message}><Input id="employee-job-title" {...form.register("job_title")} /></Field><Field id="employee-phone" label="Phone" error={form.formState.errors.phone?.message}><Input id="employee-phone" type="tel" {...form.register("phone")} /></Field><Field id="employee-hire-date" label="Hire date"><Input id="employee-hire-date" type="date" {...form.register("hire_date")} /></Field>{canManage && <><Field id="employee-department" label="Department"><SelectControl id="employee-department" className="w-full" {...form.register("department_id")}><option value="">No department</option>{departments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</SelectControl></Field><Field id="employee-manager" label="Manager"><SelectControl id="employee-manager" className="w-full" {...form.register("manager_id")}><option value="">No manager</option>{managers.filter((item) => item.id !== employee.id).map((item) => <option key={item.id} value={item.id}>{item.first_name} {item.last_name}</option>)}</SelectControl></Field><Field id="employee-status" label="Employment status"><SelectControl id="employee-status" className="w-full" {...form.register("employment_status")}>{EMPLOYMENT_STATUSES.map((status) => <option key={status} value={status}>{employmentStatusLabel[status]}</option>)}</SelectControl></Field></>}</div>
    <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end"><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button disabled={mutation.isPending}>{mutation.isPending && <LoaderCircle className="size-4 animate-spin" />}Save changes</Button></div>
  </form></DialogContent></Dialog>;
}

function values(employee: Employee): EmployeeValues { return { first_name: employee.first_name, last_name: employee.last_name, job_title: employee.job_title ?? "", phone: employee.phone ?? "", department_id: employee.department_id ?? "", manager_id: employee.manager_id ?? "", hire_date: employee.hire_date ?? "", employment_status: employee.employment_status }; }
function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: React.ReactNode }) { return <div className="space-y-2"><Label htmlFor={id}>{label}</Label>{children}{error && <p role="alert" className="text-xs text-destructive">{error}</p>}</div>; }
