import { AlertTriangle, Bot, CheckCircle2, Clock3, Sparkles } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { ExecutiveBrief as ExecutiveBriefData } from "@/lib/types/dashboard";

export function ExecutiveBrief({ brief }: { brief: ExecutiveBriefData }) {
  const generated = brief.status === "generated";
  return (
    <Card className="overflow-hidden border-primary/20 bg-[radial-gradient(circle_at_top_right,color-mix(in_srgb,var(--primary)_18%,transparent),transparent_44%)]">
      <CardContent className="p-5 sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20" aria-hidden="true">
            <Sparkles className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold tracking-tight">AI executive brief</h2>
              <Badge variant={generated ? "default" : "warning"}>{generated ? <CheckCircle2 className="mr-1 size-3" /> : <AlertTriangle className="mr-1 size-3" />}{generated ? "Generated today" : "Live fallback"}</Badge>
            </div>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground"><Clock3 className="size-3" />Updated {new Date(brief.generated_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</p>
            <div className="mt-5 whitespace-pre-line text-sm leading-6 sm:text-[15px]" aria-live="polite">{brief.content}</div>
            <p className="mt-4 text-xs text-muted-foreground">{brief.unavailable_reason ?? "AI-generated summaries may be inaccurate. Open the source workspaces to verify details."}</p>
          </div>
          <Button variant="outline" size="sm" asChild className="shrink-0"><Link href="/assistant"><Bot className="size-3.5" />Explore with AI</Link></Button>
        </div>
      </CardContent>
    </Card>
  );
}

