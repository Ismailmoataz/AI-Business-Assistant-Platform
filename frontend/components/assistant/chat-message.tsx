"use client";

import dynamic from "next/dynamic";
import { memo, useState } from "react";
import { Bot, Check, Copy, RefreshCw, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { ConversationMessage } from "@/lib/types/conversations";
import { MessageCitations } from "./message-citations";

const MarkdownMessage = dynamic(
  () => import("./markdown-message").then((module) => module.MarkdownMessage),
  { loading: () => <div className="space-y-2"><Skeleton className="h-4 w-4/5" /><Skeleton className="h-4 w-3/5" /></div> },
);

interface ChatMessageProps {
  message: ConversationMessage;
  isStreaming?: boolean;
  canRegenerate?: boolean;
  onRegenerate?: (messageId: string) => void;
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

export const ChatMessage = memo(function ChatMessage({ message, isStreaming = false, canRegenerate = false, onRegenerate }: ChatMessageProps) {
  const [copied, setCopied] = useState(false);

  if (message.role === "system") {
    return <p className="mx-auto max-w-2xl rounded-full bg-muted px-4 py-2 text-center text-xs text-muted-foreground">{message.content}</p>;
  }

  if (message.role === "user") {
    return (
      <article className="flex justify-end gap-3" aria-label={`You at ${formatTimestamp(message.created_at)}`}>
        <div className="max-w-[min(82%,46rem)] rounded-2xl rounded-br-md bg-primary px-4 py-3 text-[15px] leading-6 text-primary-foreground shadow-sm">
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        </div>
        <span className="mt-1 hidden size-8 shrink-0 place-items-center rounded-lg bg-foreground text-background sm:grid">
          <UserRound className="size-4" />
        </span>
      </article>
    );
  }

  const copy = async () => {
    if (!message.content) return;
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <article className="group flex gap-3 sm:gap-4" aria-label={`Orbit AI at ${formatTimestamp(message.created_at)}`}>
      <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground shadow-sm">
        <Bot className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-2">
          <p className="text-sm font-semibold">Orbit AI</p>
          {isStreaming && <span className="text-xs text-primary">Generating</span>}
        </div>
        <div className={cn("min-h-6 text-[15px] leading-7", isStreaming && !message.content && "flex items-center")}>
          {message.content ? (
            <MarkdownMessage content={message.content} />
          ) : (
            <div className="flex items-center gap-1" role="status" aria-label="Orbit is thinking">
              {[0, 1, 2].map((index) => <span key={index} className="size-1.5 animate-bounce rounded-full bg-primary" style={{ animationDelay: `${index * 120}ms` }} />)}
            </div>
          )}
        </div>
        {!isStreaming && <MessageCitations citations={message.citations} />}
        {!isStreaming && (
          <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground opacity-70 transition group-hover:opacity-100 group-focus-within:opacity-100">
            <span className="mr-1">{formatTimestamp(message.created_at)}</span>
            <Button type="button" variant="ghost" size="sm" className="h-7 px-2" onClick={copy} aria-label="Copy assistant response">
              {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              <span className="sr-only sm:not-sr-only">{copied ? "Copied" : "Copy"}</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2"
              disabled={!canRegenerate}
              onClick={() => onRegenerate?.(message.id)}
              aria-label="Regenerate assistant response"
            >
              <RefreshCw className="size-3.5" />
              <span className="sr-only sm:not-sr-only">Regenerate</span>
            </Button>
          </div>
        )}
      </div>
    </article>
  );
});
