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
import { businessApi, businessKeys } from "@/lib/api/business";
import type { Tag } from "@/lib/types/business";
import { tagSchema, type TagValues } from "@/lib/validations/business";

export function TagFormDialog({ open, onOpenChange, tag }: { open: boolean; onOpenChange: (open: boolean) => void; tag?: Tag | null }) {
  const queryClient = useQueryClient();
  const form = useForm<TagValues>({ resolver: zodResolver(tagSchema), defaultValues: { name: tag?.name ?? "", color: tag?.color ?? "#6366F1" } });
  useEffect(() => { if (open) form.reset({ name: tag?.name ?? "", color: tag?.color ?? "#6366F1" }); }, [form, open, tag]);
  const mutation = useMutation({ mutationFn: (input: TagValues) => tag ? businessApi.tags.update(tag.id, input) : businessApi.tags.create(input), onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: businessKeys.tags }); toast.success(tag ? "Tag updated" : "Tag created"); onOpenChange(false); }, onError: (error) => toast.error(error instanceof Error ? error.message : "Tag could not be saved") });
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-w-md"><DialogTitle className="text-lg font-semibold">{tag ? "Edit tag" : "Create tag"}</DialogTitle><DialogDescription className="text-sm text-muted-foreground">Use a clear reusable label and an accessible identifying color.</DialogDescription><form className="mt-5 space-y-4" onSubmit={form.handleSubmit((input) => mutation.mutate(input))} noValidate><div className="space-y-2"><Label htmlFor="tag-name">Tag name</Label><Input id="tag-name" autoFocus {...form.register("name")} />{form.formState.errors.name && <p role="alert" className="text-xs text-destructive">{form.formState.errors.name.message}</p>}</div><div className="space-y-2"><Label htmlFor="tag-color-hex">Color</Label><div className="flex gap-3"><Input type="color" className="w-14 p-1" aria-label="Tag color picker" {...form.register("color")} /><Input id="tag-color-hex" aria-label="Tag color hex value" {...form.register("color")} /></div>{form.formState.errors.color && <p role="alert" className="text-xs text-destructive">{form.formState.errors.color.message}</p>}</div><div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end"><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button disabled={mutation.isPending}>{mutation.isPending && <LoaderCircle className="size-4 animate-spin" />}{tag ? "Save changes" : "Create tag"}</Button></div></form></DialogContent></Dialog>;
}
