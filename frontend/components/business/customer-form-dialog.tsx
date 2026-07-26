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
import { Textarea } from "@/components/ui/textarea";
import { CUSTOMER_STATUSES, SelectControl, customerStatusLabel } from "@/components/business/shared";
import { businessApi, businessKeys } from "@/lib/api/business";
import type { Customer, CustomerInput, Tag } from "@/lib/types/business";
import { customerSchema, type CustomerValues } from "@/lib/validations/business";

export function CustomerFormDialog({ open, onOpenChange, customer, tags }: { open: boolean; onOpenChange: (open: boolean) => void; customer?: Customer | null; tags: Tag[] }) {
  const queryClient = useQueryClient();
  const form = useForm<CustomerValues>({ resolver: zodResolver(customerSchema), defaultValues: values(customer) });
  useEffect(() => { if (open) form.reset(values(customer)); }, [customer, form, open]);
  const mutation = useMutation({
    mutationFn: (input: CustomerValues) => { const payload: CustomerInput = { ...input, email: input.email || null, phone: input.phone || null, contact_name: input.contact_name || null, notes: input.notes || null }; return customer ? businessApi.customers.update(customer.id, payload) : businessApi.customers.create(payload); },
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: businessKeys.customers }); toast.success(customer ? "Customer updated" : "Customer created"); onOpenChange(false); },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Customer could not be saved"),
  });
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[calc(100dvh-2rem)] max-w-2xl overflow-y-auto"><DialogTitle className="text-lg font-semibold">{customer ? "Edit customer" : "Create customer"}</DialogTitle><DialogDescription className="text-sm text-muted-foreground">Maintain the relationship, primary contact, and shared customer context.</DialogDescription><form className="mt-5 space-y-5" onSubmit={form.handleSubmit((input) => mutation.mutate(input))} noValidate>
    <div className="grid gap-4 sm:grid-cols-2"><Field id="customer-name" label="Customer name" error={form.formState.errors.name?.message}><Input id="customer-name" autoFocus {...form.register("name")} /></Field><Field id="customer-type" label="Type"><SelectControl id="customer-type" className="w-full" {...form.register("customer_type")}><option value="company">Company</option><option value="individual">Individual</option></SelectControl></Field><Field id="customer-status" label="Status"><SelectControl id="customer-status" className="w-full" {...form.register("status")}>{CUSTOMER_STATUSES.map((status) => <option key={status} value={status}>{customerStatusLabel[status]}</option>)}</SelectControl></Field><Field id="customer-contact" label="Contact name"><Input id="customer-contact" {...form.register("contact_name")} /></Field><Field id="customer-email" label="Email" error={form.formState.errors.email?.message}><Input id="customer-email" type="email" {...form.register("email")} /></Field><Field id="customer-phone" label="Phone"><Input id="customer-phone" type="tel" {...form.register("phone")} /></Field></div><Field id="customer-notes" label="CRM notes"><Textarea id="customer-notes" rows={5} {...form.register("notes")} /></Field><fieldset><legend className="mb-2 text-sm font-medium">Tags</legend><div className="flex flex-wrap gap-2">{tags.map((tag) => <label key={tag.id} className="inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-xs"><input type="checkbox" value={tag.id} {...form.register("tag_ids")} /><span className="size-2 rounded-full" style={{ backgroundColor: tag.color ?? "var(--primary)" }} />{tag.name}</label>)}</div></fieldset>
    <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end"><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button disabled={mutation.isPending}>{mutation.isPending && <LoaderCircle className="size-4 animate-spin" />}{customer ? "Save changes" : "Create customer"}</Button></div>
  </form></DialogContent></Dialog>;
}

function values(customer?: Customer | null): CustomerValues { return { customer_type: customer?.customer_type ?? "company", name: customer?.name ?? "", status: customer?.status ?? "prospect", email: customer?.email ?? "", phone: customer?.phone ?? "", contact_name: customer?.contact_name ?? "", notes: customer?.notes ?? "", tag_ids: customer?.tags.map((tag) => tag.id) ?? [] }; }
function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: React.ReactNode }) { return <div className="space-y-2"><Label htmlFor={id}>{label}</Label>{children}{error && <p role="alert" className="text-xs text-destructive">{error}</p>}</div>; }
