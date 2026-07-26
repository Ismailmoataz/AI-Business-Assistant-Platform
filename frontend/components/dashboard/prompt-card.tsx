"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp, Bot, FileText, FolderKanban, ListTodo } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const suggestions = [
  [FileText, "Find a document"],
  [FolderKanban, "Give me a project status summary"],
  [ListTodo, "Show me my open task priorities"],
] as const;

export function PromptCard({ embedded = false }: { embedded?: boolean }) {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const openWorkspace = (value: string) => router.push(`/assistant?prompt=${encodeURIComponent(value)}`);
  const content = (
      <div className={embedded ? "rounded-xl border border-primary/15 bg-accent/25 p-4" : ""}>
        <div className="flex gap-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20"><Bot className="size-5" /></span>
          <div><h3 className="text-lg font-semibold tracking-tight">Ask your business anything</h3><p className="mt-1 text-sm text-muted-foreground">Your AI assistant understands your company knowledge and work.</p></div>
        </div>
        <form className="mt-7 flex gap-2" onSubmit={(event) => { event.preventDefault(); if (prompt.trim()) openWorkspace(prompt.trim()); }}>
          <Input value={prompt} onChange={(event) => setPrompt(event.target.value)} aria-label="Ask AI assistant" placeholder="Summarize our priorities for this week…" className="h-11 bg-background/80" />
          <Button size="icon" className="size-11 shrink-0" aria-label="Open AI workspace" disabled={!prompt.trim()}><ArrowUp className="size-4" /></Button>
        </form>
        <div className="mt-3 flex flex-wrap gap-2">
          {suggestions.map(([Icon, label]) => <button type="button" key={label} onClick={() => openWorkspace(label)} className="flex items-center gap-1.5 rounded-full border bg-card/70 px-3 py-1.5 text-xs text-muted-foreground transition hover:border-primary/30 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><Icon className="size-3" />{label}</button>)}
        </div>
      </div>
  );
  if (embedded) return content;
  return <Card className="overflow-hidden border-primary/15 bg-[radial-gradient(circle_at_top_right,color-mix(in_srgb,var(--primary)_16%,transparent),transparent_42%)]"><CardContent className="p-5 sm:p-7">{content}</CardContent></Card>;
}
