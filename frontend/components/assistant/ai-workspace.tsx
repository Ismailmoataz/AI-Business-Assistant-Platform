"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData, type QueryKey } from "@tanstack/react-query";
import { ArrowDown, CircleAlert, Menu, MessageSquarePlus, Sparkles } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { ChatMessage } from "./chat-message";
import { ConversationSidebar } from "./conversation-sidebar";
import { EmptyConversation } from "./empty-conversation";
import { PromptComposer } from "./prompt-composer";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { conversationKeys, conversationsApi, streamConversationMessage, streamRegeneratedMessage } from "@/lib/api/conversations";
import { ApiRequestError } from "@/lib/api/client";
import { useAuthStore } from "@/stores/auth-store";
import type { Conversation, ConversationMessage, ConversationPage } from "@/lib/types/conversations";

const PAGE_SIZE = 20;
type ConversationPages = InfiniteData<ConversationPage, number>;
type ConversationSnapshot = [QueryKey, ConversationPages | undefined][];
type GenerationRetry =
  | { kind: "send"; prompt: string }
  | { kind: "regenerate"; assistantMessageId: string };

function generatedTitle(content: string) {
  const words = content.trim().match(/[\w'-]+/g)?.slice(0, 8) ?? [];
  return words.length ? words.join(" ").replace(/^./, (character) => character.toUpperCase()) : "New conversation";
}

function updateConversationPages(
  data: ConversationPages | undefined,
  update: (conversation: Conversation) => Conversation | null,
): ConversationPages | undefined {
  if (!data) return data;
  return {
    ...data,
    pages: data.pages.map((page) => ({ ...page, items: page.items.map(update).filter((item): item is Conversation => item !== null) })),
  };
}

function prependConversation(data: ConversationPages | undefined, conversation: Conversation): ConversationPages {
  if (!data) {
    return { pages: [{ items: [conversation], page: { offset: 0, limit: PAGE_SIZE, total: 1 } }], pageParams: [0] };
  }
  return {
    ...data,
    pages: data.pages.map((page, index) => ({
      ...page,
      items: index === 0 ? [conversation, ...page.items.filter((item) => item.id !== conversation.id)] : page.items.filter((item) => item.id !== conversation.id),
      page: { ...page.page, total: page.page.total + 1 },
    })),
  };
}

function removeConversation(data: ConversationPages | undefined, conversationId: string): ConversationPages | undefined {
  if (!data) return data;
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      items: page.items.filter((item) => item.id !== conversationId),
      page: { ...page.page, total: Math.max(0, page.page.total - 1) },
    })),
  };
}

function temporaryMessage(conversationId: string, role: "user" | "assistant", content: string): ConversationMessage {
  return {
    id: `temporary-${role}-${crypto.randomUUID()}`,
    conversation_id: conversationId,
    role,
    content,
    citations: [],
    created_at: new Date().toISOString(),
  };
}

export function AIWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const tokens = useAuthStore((state) => state.tokens);
  const hasHydrated = useAuthStore((state) => state.hasHydrated);
  const initialConversationId = searchParams.get("conversation");
  const [activeConversationId, setActiveConversationId] = useState<string | null>(initialConversationId);
  const [draft, setDraft] = useState(searchParams.get("prompt") ?? "");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [optimisticUser, setOptimisticUser] = useState<ConversationMessage | null>(null);
  const [pendingAssistant, setPendingAssistant] = useState<ConversationMessage | null>(null);
  const [replacingAssistantId, setReplacingAssistantId] = useState<string | null>(null);
  const [generationError, setGenerationError] = useState<{ conversationId: string; retry: GenerationRetry; message: string } | null>(null);
  const [showScrollLatest, setShowScrollLatest] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesViewportRef = useRef<HTMLDivElement>(null);
  const followLatestRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);
  const tokenBufferRef = useRef("");
  const tokenFrameRef = useRef<number | null>(null);
  const activeConversationRef = useRef(activeConversationId);

  useEffect(() => { activeConversationRef.current = activeConversationId; }, [activeConversationId]);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    if (hasHydrated && !tokens) router.replace("/login");
  }, [hasHydrated, router, tokens]);
  useEffect(() => () => {
    abortControllerRef.current?.abort();
    if (tokenFrameRef.current !== null) window.cancelAnimationFrame(tokenFrameRef.current);
  }, []);

  const conversationsQuery = useInfiniteQuery({
    queryKey: conversationKeys.list(debouncedSearch),
    queryFn: ({ pageParam }) => conversationsApi.list(pageParam, PAGE_SIZE, debouncedSearch),
    initialPageParam: 0,
    enabled: hasHydrated && Boolean(tokens),
    getNextPageParam: (lastPage) => {
      const nextOffset = lastPage.page.offset + lastPage.items.length;
      return nextOffset < lastPage.page.total ? nextOffset : undefined;
    },
  });

  const conversations = useMemo(
    () => conversationsQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [conversationsQuery.data],
  );

  const conversationQuery = useQuery({
    queryKey: conversationKeys.detail(activeConversationId ?? "none"),
    queryFn: () => conversationsApi.get(activeConversationId!),
    enabled: hasHydrated && Boolean(tokens && activeConversationId),
  });

  const setConversationUrl = useCallback((conversationId: string | null) => {
    router.replace(conversationId ? `/assistant?conversation=${conversationId}` : "/assistant", { scroll: false });
  }, [router]);

  const resetGenerationView = useCallback(() => {
    setOptimisticUser(null);
    setPendingAssistant(null);
    setReplacingAssistantId(null);
    setGenerationError(null);
    tokenBufferRef.current = "";
    if (tokenFrameRef.current !== null) {
      window.cancelAnimationFrame(tokenFrameRef.current);
      tokenFrameRef.current = null;
    }
  }, []);

  const focusComposer = useCallback(() => {
    window.requestAnimationFrame(() => textareaRef.current?.focus());
  }, []);

  const openConversation = useCallback((conversationId: string) => {
    abortControllerRef.current?.abort();
    resetGenerationView();
    followLatestRef.current = true;
    setShowScrollLatest(false);
    setActiveConversationId(conversationId);
    setConversationUrl(conversationId);
    setMobileSidebarOpen(false);
    focusComposer();
  }, [focusComposer, resetGenerationView, setConversationUrl]);

  const createMutation = useMutation({ mutationFn: () => conversationsApi.create() });

  const createConversation = useCallback(async () => {
    const conversation = await createMutation.mutateAsync();
    queryClient.setQueryData<ConversationPages>(conversationKeys.list(), (data) => prependConversation(data, conversation));
    openConversation(conversation.id);
    return conversation;
  }, [createMutation, openConversation, queryClient]);

  const handleNewConversation = useCallback(async () => {
    try {
      await createConversation();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not start a conversation");
    }
  }, [createConversation]);

  const handleRename = useCallback(async (conversationId: string, title: string) => {
    const snapshots = queryClient.getQueriesData<ConversationPages>({ queryKey: conversationKeys.lists }) as ConversationSnapshot;
    queryClient.setQueriesData<ConversationPages>({ queryKey: conversationKeys.lists }, (data) => updateConversationPages(data, (conversation) =>
      conversation.id === conversationId ? { ...conversation, title, updated_at: new Date().toISOString() } : conversation,
    ));
    try {
      const updated = await conversationsApi.rename(conversationId, title);
      queryClient.setQueriesData<ConversationPages>({ queryKey: conversationKeys.lists }, (data) => updateConversationPages(data, (conversation) =>
        conversation.id === conversationId ? updated : conversation,
      ));
      queryClient.setQueryData(conversationKeys.detail(conversationId), (detail: unknown) =>
        detail && typeof detail === "object" ? { ...detail, ...updated } : detail,
      );
      void queryClient.invalidateQueries({ queryKey: conversationKeys.lists });
      toast.success("Conversation renamed");
    } catch (error) {
      for (const [key, snapshot] of snapshots) queryClient.setQueryData(key, snapshot);
      toast.error(error instanceof Error ? error.message : "Could not rename the conversation");
      throw error;
    }
  }, [queryClient]);

  const handleDelete = useCallback(async (conversationId: string) => {
    const snapshots = queryClient.getQueriesData<ConversationPages>({ queryKey: conversationKeys.lists }) as ConversationSnapshot;
    const wasActive = activeConversationRef.current === conversationId;
    const nextConversation = conversations.find((conversation) => conversation.id !== conversationId) ?? null;
    abortControllerRef.current?.abort();
    queryClient.setQueriesData<ConversationPages>({ queryKey: conversationKeys.lists }, (data) => removeConversation(data, conversationId));
    if (wasActive) {
      resetGenerationView();
      setActiveConversationId(nextConversation?.id ?? null);
      setConversationUrl(nextConversation?.id ?? null);
    }
    try {
      await conversationsApi.delete(conversationId);
      queryClient.removeQueries({ queryKey: conversationKeys.detail(conversationId) });
      toast.success("Conversation deleted");
    } catch (error) {
      for (const [key, snapshot] of snapshots) queryClient.setQueryData(key, snapshot);
      if (wasActive) {
        setActiveConversationId(conversationId);
        setConversationUrl(conversationId);
      }
      toast.error(error instanceof Error ? error.message : "Could not delete the conversation");
      throw error;
    }
  }, [conversations, queryClient, resetGenerationView, setConversationUrl]);

  const flushTokens = useCallback(() => {
    const buffered = tokenBufferRef.current;
    tokenBufferRef.current = "";
    tokenFrameRef.current = null;
    if (!buffered) return;
    setPendingAssistant((message) => message ? { ...message, content: message.content + buffered } : message);
  }, []);

  const queueToken = useCallback((token: string) => {
    tokenBufferRef.current += token;
    if (tokenFrameRef.current === null) tokenFrameRef.current = window.requestAnimationFrame(flushTokens);
  }, [flushTokens]);

  const updateConversationPreview = useCallback((conversationId: string, content: string) => {
    queryClient.setQueriesData<ConversationPages>({ queryKey: conversationKeys.lists }, (data) => updateConversationPages(data, (conversation) => {
      if (conversation.id !== conversationId) return conversation;
      return {
        ...conversation,
        title: conversation.title ?? generatedTitle(content),
        last_message_preview: content.slice(0, 180),
        updated_at: new Date().toISOString(),
      };
    }));
  }, [queryClient]);

  const runStream = useCallback(async ({
    conversationId,
    optimisticMessage,
    assistantMessage,
    replacementId,
    retry,
    request,
    followLatest,
  }: {
    conversationId: string;
    optimisticMessage: ConversationMessage | null;
    assistantMessage: ConversationMessage;
    replacementId: string | null;
    retry: GenerationRetry;
    request: (controller: AbortController) => Promise<void>;
    followLatest: boolean;
  }) => {
    const controller = new AbortController();
    abortControllerRef.current = controller;
    if (followLatest) {
      followLatestRef.current = true;
      setShowScrollLatest(false);
    } else {
      followLatestRef.current = false;
    }
    setGenerationError(null);
    setOptimisticUser(optimisticMessage);
    setPendingAssistant(assistantMessage);
    setReplacingAssistantId(replacementId);
    setIsGenerating(true);

    try {
      await request(controller);
    } catch (error) {
      const cancelled = controller.signal.aborted || (error instanceof DOMException && error.name === "AbortError");
      if (cancelled) {
        toast.message("Generation stopped");
      } else if (activeConversationRef.current === conversationId) {
        const message = error instanceof ApiRequestError || error instanceof Error ? error.message : "The assistant could not complete the response";
        setGenerationError({ conversationId, retry, message });
        toast.error(message);
      }
    } finally {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: conversationKeys.detail(conversationId) }),
        queryClient.invalidateQueries({ queryKey: conversationKeys.lists }),
      ]);
      if (tokenFrameRef.current !== null) window.cancelAnimationFrame(tokenFrameRef.current);
      tokenFrameRef.current = null;
      tokenBufferRef.current = "";
      setOptimisticUser((message) => message?.conversation_id === conversationId ? null : message);
      setPendingAssistant((message) => message?.conversation_id === conversationId ? null : message);
      setReplacingAssistantId((messageId) => messageId === replacementId ? null : messageId);
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
        setIsGenerating(false);
        focusComposer();
      }
    }
  }, [focusComposer, queryClient]);

  const generate = useCallback(async (rawContent: string) => {
    const content = rawContent.trim();
    if (!content || isGenerating || createMutation.isPending) return;
    let conversationId = activeConversationRef.current;
    try {
      if (!conversationId) conversationId = (await createConversation()).id;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not start a conversation");
      return;
    }

    setDraft("");
    updateConversationPreview(conversationId, content);
    await runStream({
      conversationId,
      optimisticMessage: temporaryMessage(conversationId, "user", content),
      assistantMessage: temporaryMessage(conversationId, "assistant", ""),
      replacementId: null,
      retry: { kind: "send", prompt: content },
      followLatest: true,
      request: (controller) => streamConversationMessage(conversationId, content, {
        signal: controller.signal,
        onToken: queueToken,
        onComplete: (completion) => {
          flushTokens();
          setPendingAssistant((message) => message ? {
            ...message,
            id: completion.message_id || message.id,
            citations: completion.citations,
          } : message);
        },
      }),
    });
  }, [createConversation, createMutation.isPending, flushTokens, isGenerating, queueToken, runStream, updateConversationPreview]);

  const stopGeneration = useCallback(() => abortControllerRef.current?.abort(), []);

  const messages = useMemo(() => {
    const stored = conversationQuery.data?.messages ?? [];
    const displayedStored = replacingAssistantId && pendingAssistant?.conversation_id === activeConversationId
      ? stored.map((message) => message.id === replacingAssistantId ? pendingAssistant : message)
      : stored;
    return [
      ...displayedStored,
      ...(optimisticUser?.conversation_id === activeConversationId ? [optimisticUser] : []),
      ...(pendingAssistant?.conversation_id === activeConversationId && !replacingAssistantId ? [pendingAssistant] : []),
    ];
  }, [activeConversationId, conversationQuery.data?.messages, optimisticUser, pendingAssistant, replacingAssistantId]);

  const messagesRef = useRef(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const regeneratableMessageIds = useMemo(() => {
    const ids = new Set<string>();
    let hasUserMessage = false;
    for (const message of messages) {
      if (message.role === "user") hasUserMessage = true;
      if (message.role === "assistant" && hasUserMessage) ids.add(message.id);
    }
    return ids;
  }, [messages]);

  const regenerate = useCallback(async (assistantMessageId: string) => {
    if (isGenerating) return;
    const conversationId = activeConversationRef.current;
    if (!conversationId) return;
    const currentMessages = messagesRef.current;
    const assistant = currentMessages.find((message) => message.id === assistantMessageId && message.role === "assistant");
    if (!assistant || assistant.id.startsWith("temporary-")) return;

    await runStream({
      conversationId,
      optimisticMessage: null,
      assistantMessage: { ...assistant, content: "", citations: [] },
      replacementId: assistantMessageId,
      retry: { kind: "regenerate", assistantMessageId },
      followLatest: false,
      request: (controller) => streamRegeneratedMessage(conversationId, assistantMessageId, {
        signal: controller.signal,
        onToken: queueToken,
        onComplete: (completion) => {
          flushTokens();
          setPendingAssistant((message) => message ? { ...message, citations: completion.citations } : message);
        },
      }),
    });
  }, [flushTokens, isGenerating, queueToken, runStream]);

  const retryGeneration = useCallback(() => {
    if (!generationError) return;
    if (generationError.retry.kind === "send") {
      void generate(generationError.retry.prompt);
    } else {
      void regenerate(generationError.retry.assistantMessageId);
    }
  }, [generate, generationError, regenerate]);

  const scrollToLatest = useCallback((behavior: ScrollBehavior = "smooth") => {
    const viewport = messagesViewportRef.current;
    if (!viewport) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    viewport.scrollTo({ top: viewport.scrollHeight, behavior: reducedMotion ? "auto" : behavior });
    followLatestRef.current = true;
    setShowScrollLatest(false);
  }, []);

  useEffect(() => {
    if (!followLatestRef.current) return;
    const frame = window.requestAnimationFrame(() => scrollToLatest("auto"));
    return () => window.cancelAnimationFrame(frame);
  }, [messages, scrollToLatest]);

  const handleMessagesScroll = () => {
    const viewport = messagesViewportRef.current;
    if (!viewport) return;
    const distance = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
    followLatestRef.current = distance < 120;
    setShowScrollLatest(distance >= 120);
  };

  if (!hasHydrated || !tokens) return <WorkspaceSkeleton />;

  const activeConversation = conversations.find((conversation) => conversation.id === activeConversationId) ?? conversationQuery.data ?? null;

  const sidebar = (
    <ConversationSidebar
      conversations={conversations}
      activeConversationId={activeConversationId}
      search={search}
      onSearchChange={setSearch}
      onSelect={openConversation}
      onNew={() => void handleNewConversation()}
      onRename={handleRename}
      onDelete={handleDelete}
      isLoading={conversationsQuery.isLoading}
      isError={conversationsQuery.isError}
      isCreating={createMutation.isPending}
      retry={() => void conversationsQuery.refetch()}
      hasNextPage={Boolean(conversationsQuery.hasNextPage)}
      isFetchingNextPage={conversationsQuery.isFetchingNextPage}
      fetchNextPage={() => void conversationsQuery.fetchNextPage()}
      className="h-full"
    />
  );

  return (
    <div className="flex h-full min-h-0 overflow-hidden bg-background">
      <div className="hidden w-[18rem] shrink-0 md:block xl:w-[20rem]">{sidebar}</div>
      <section className="flex min-w-0 flex-1 flex-col" aria-label="AI conversation workspace">
        <header className="flex h-16 shrink-0 items-center gap-3 border-b px-3 sm:px-5">
          <Button type="button" variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileSidebarOpen(true)} aria-label="Open conversation history">
            <Menu className="size-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-semibold sm:text-base">{activeConversation?.title ?? "New conversation"}</h1>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Sparkles className="size-3 text-primary" />Grounded in your company knowledge
            </p>
          </div>
          {isGenerating && <span className="hidden rounded-full bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground sm:inline">Generating</span>}
          <Button type="button" variant="outline" size="sm" onClick={() => void handleNewConversation()} disabled={createMutation.isPending}>
            <MessageSquarePlus className="size-4" /><span className="hidden sm:inline">New chat</span>
          </Button>
        </header>

        <div className="relative min-h-0 flex-1">
          <div
            ref={messagesViewportRef}
            onScroll={handleMessagesScroll}
            className="absolute inset-0 overflow-y-auto overscroll-contain"
            role="log"
            aria-live="polite"
            aria-busy={isGenerating}
            aria-label="Conversation messages"
          >
            {conversationQuery.isLoading && activeConversationId ? (
              <MessagesSkeleton />
            ) : conversationQuery.isError && activeConversationId ? (
              <div className="mx-auto grid min-h-full max-w-xl place-items-center p-6"><ErrorState title="Conversation unavailable" description="It may have been deleted, or your session may need to be refreshed." retry={() => void conversationQuery.refetch()} /></div>
            ) : messages.length === 0 ? (
              <EmptyConversation onSuggestion={(value) => { setDraft(value); focusComposer(); }} />
            ) : (
              <div className="mx-auto w-full max-w-4xl space-y-8 px-4 py-7 sm:px-6 sm:py-10">
                {messages.map((message) => (
                  <ChatMessage
                    key={message.id}
                    message={message}
                    isStreaming={message.id === pendingAssistant?.id && isGenerating}
                    canRegenerate={!isGenerating && regeneratableMessageIds.has(message.id)}
                    onRegenerate={regenerate}
                  />
                ))}
                {generationError?.conversationId === activeConversationId && (
                  <div role="alert" className="ml-11 flex flex-col gap-3 rounded-xl border border-destructive/25 bg-destructive/5 p-4 text-sm sm:flex-row sm:items-center">
                    <CircleAlert className="size-5 shrink-0 text-destructive" />
                    <p className="min-w-0 flex-1"><span className="font-medium">Response interrupted.</span> <span className="text-muted-foreground">{generationError.message}</span></p>
                    <Button type="button" variant="outline" size="sm" onClick={retryGeneration}>Try again</Button>
                  </div>
                )}
                <div className="h-1" aria-hidden="true" />
              </div>
            )}
          </div>
          {showScrollLatest && (
            <Button type="button" variant="outline" size="sm" className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-card shadow-lg" onClick={() => scrollToLatest()}>
              <ArrowDown className="size-3.5" />Scroll to latest
            </Button>
          )}
        </div>

        <PromptComposer
          value={draft}
          onChange={setDraft}
          onSubmit={() => void generate(draft)}
          onCancel={stopGeneration}
          isGenerating={isGenerating}
          isCreatingConversation={createMutation.isPending}
          textareaRef={textareaRef}
        />
      </section>

      <Dialog open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
        <DialogContent className="left-0 top-0 h-dvh w-[min(88vw,340px)] max-w-none translate-x-0 translate-y-0 rounded-none p-0 [&>button]:right-14 [&>button]:top-3">
          <DialogTitle className="sr-only">Conversation history</DialogTitle>
          <DialogDescription className="sr-only">Search, open, rename, or delete your conversations.</DialogDescription>
          {sidebar}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MessagesSkeleton() {
  return (
    <div className="mx-auto w-full max-w-4xl space-y-9 px-4 py-10" role="status" aria-label="Loading conversation">
      <div className="flex justify-end"><Skeleton className="h-20 w-2/3 rounded-2xl" /></div>
      <div className="flex gap-4"><Skeleton className="size-8 shrink-0" /><div className="flex-1 space-y-2"><Skeleton className="h-4 w-1/4" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-4/5" /><Skeleton className="h-4 w-2/3" /></div></div>
      <div className="flex justify-end"><Skeleton className="h-14 w-1/2 rounded-2xl" /></div>
      <div className="flex gap-4"><Skeleton className="size-8 shrink-0" /><div className="flex-1 space-y-2"><Skeleton className="h-4 w-1/4" /><Skeleton className="h-4 w-5/6" /><Skeleton className="h-4 w-3/5" /></div></div>
    </div>
  );
}

function WorkspaceSkeleton() {
  return (
    <div className="flex h-full min-h-0" role="status" aria-label="Loading AI workspace">
      <div className="hidden w-72 space-y-3 border-r p-4 md:block"><Skeleton className="h-10 w-full" />{Array.from({ length: 7 }).map((_, index) => <Skeleton key={index} className="h-16 w-full" />)}</div>
      <div className="flex flex-1 flex-col"><div className="h-16 border-b" /><MessagesSkeleton /><div className="mt-auto border-t p-4"><Skeleton className="mx-auto h-24 max-w-4xl rounded-2xl" /></div></div>
    </div>
  );
}
