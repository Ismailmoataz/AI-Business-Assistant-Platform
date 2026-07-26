"use client";

import { useLayoutEffect, type KeyboardEvent, type RefObject } from "react";
import { ArrowUp, LoaderCircle, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PromptComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  isGenerating: boolean;
  isCreatingConversation: boolean;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
}

export function PromptComposer({
  value,
  onChange,
  onSubmit,
  onCancel,
  isGenerating,
  isCreatingConversation,
  textareaRef,
}: PromptComposerProps) {
  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
  }, [textareaRef, value]);

  const submit = () => {
    if (!value.trim() || isGenerating || isCreatingConversation) return;
    onSubmit();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
  };

  return (
    <div className="border-t bg-background/95 px-3 py-3 backdrop-blur-xl sm:px-5 sm:py-4">
      <div className="mx-auto max-w-4xl">
        <div
          className={cn(
            "rounded-2xl border bg-card p-2 shadow-[0_12px_40px_rgb(0_0_0/.08)] transition focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/20",
            isGenerating && "border-primary/25",
          )}
        >
          <label className="sr-only" htmlFor="assistant-prompt">Message Orbit AI</label>
          <textarea
            ref={textareaRef}
            id="assistant-prompt"
            value={value}
            rows={1}
            maxLength={20000}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={handleKeyDown}
            aria-describedby="composer-help composer-status"
            placeholder="Ask about your company knowledge, projects, or priorities…"
            className="max-h-[200px] min-h-11 w-full resize-none bg-transparent px-3 py-2.5 text-[15px] leading-6 outline-none placeholder:text-muted-foreground"
          />
          <div className="flex items-center justify-between gap-3 px-1 pb-1">
            <p id="composer-help" className="hidden text-xs text-muted-foreground sm:block">
              Enter to send · Shift + Enter for a new line
            </p>
            <p id="composer-status" className="text-xs text-muted-foreground" aria-live="polite">
              {isGenerating ? "Orbit is generating a response" : `${value.length.toLocaleString()} / 20,000`}
            </p>
            <div className="ml-auto flex items-center gap-2">
              {isGenerating && (
                <Button type="button" variant="outline" size="sm" onClick={onCancel} aria-label="Stop generating response">
                  <Square className="size-3 fill-current" />
                  <span className="hidden sm:inline">Stop</span>
                </Button>
              )}
              <Button
                type="button"
                size="icon"
                className="size-9 rounded-xl"
                onClick={submit}
                disabled={!value.trim() || isGenerating || isCreatingConversation}
                aria-label="Send message"
              >
                {isCreatingConversation ? <LoaderCircle className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
              </Button>
            </div>
          </div>
        </div>
        <p className="mt-2 text-center text-[11px] text-muted-foreground">
          AI responses may be inaccurate. Check important information against your source documents.
        </p>
      </div>
    </div>
  );
}
