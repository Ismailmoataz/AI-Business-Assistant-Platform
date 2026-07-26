import type { Metadata } from "next";
import { Suspense } from "react";
import { AIWorkspace } from "@/components/assistant/ai-workspace";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "AI Workspace" };

export default function AssistantPage() {
  return (
    <Suspense fallback={<Skeleton className="h-full min-h-[32rem] rounded-none" />}>
      <AIWorkspace />
    </Suspense>
  );
}
