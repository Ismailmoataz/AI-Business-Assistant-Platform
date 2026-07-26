import { api, apiErrorFromResponse, ApiRequestError, authorizedFetch } from "./client";
import type { ChatStreamCompletion, ChatStreamHandlers, Conversation, ConversationDetail, ConversationPage } from "@/lib/types/conversations";

export const conversationKeys = {
  all: ["conversations"] as const,
  lists: ["conversations", "list"] as const,
  list: (search = "") => ["conversations", "list", search] as const,
  detail: (conversationId: string) => ["conversations", "detail", conversationId] as const,
};

export const conversationsApi = {
  list: (offset = 0, limit = 20, search = "") => {
    const params = new URLSearchParams({ offset: String(offset), limit: String(limit) });
    if (search) params.set("search", search);
    return api<ConversationPage>(`/conversations?${params}`);
  },
  get: (conversationId: string) => api<ConversationDetail>(`/conversations/${conversationId}`),
  create: (title?: string) => api<Conversation>("/conversations", {
    method: "POST",
    body: JSON.stringify(title ? { title } : {}),
  }),
  rename: (conversationId: string, title: string) => api<Conversation>(`/conversations/${conversationId}`, {
    method: "PATCH",
    body: JSON.stringify({ title }),
  }),
  delete: (conversationId: string) => api<void>(`/conversations/${conversationId}`, { method: "DELETE" }),
};

interface SseEvent {
  event: string;
  data: string;
}

function parseSseBlock(block: string): SseEvent | null {
  let event = "message";
  const data: string[] = [];
  for (const line of block.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
  }
  return data.length ? { event, data: data.join("\n") } : null;
}

async function streamAssistant(
  path: string,
  body: Record<string, string>,
  handlers: ChatStreamHandlers,
): Promise<void> {
  const response = await authorizedFetch(path, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { Accept: "text/event-stream" },
    signal: handlers.signal,
  });
  if (!response.ok) throw await apiErrorFromResponse(response);
  if (!response.body) throw new ApiRequestError(502, "The assistant stream was unavailable");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let completed = false;

  const consume = (block: string) => {
    const parsed = parseSseBlock(block);
    if (!parsed) return;
    if (parsed.event === "error") {
      const payload = JSON.parse(parsed.data) as { detail?: string };
      throw new ApiRequestError(502, payload.detail ?? "The assistant could not complete the response");
    }
    if (parsed.event === "complete") {
      completed = true;
      const payload = JSON.parse(parsed.data) as Partial<ChatStreamCompletion>;
      handlers.onComplete({
        message_id: typeof payload.message_id === "string" ? payload.message_id : "",
        citations: Array.isArray(payload.citations) ? payload.citations : [],
      });
      return;
    }
    const payload = JSON.parse(parsed.data) as { token?: string };
    if (payload.token) handlers.onToken(payload.token);
  };

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done }).replaceAll("\r\n", "\n");
    let boundary = buffer.indexOf("\n\n");
    while (boundary !== -1) {
      consume(buffer.slice(0, boundary));
      buffer = buffer.slice(boundary + 2);
      boundary = buffer.indexOf("\n\n");
    }
    if (done) break;
  }

  if (buffer.trim()) consume(buffer);
  if (!completed && !handlers.signal.aborted) {
    throw new ApiRequestError(502, "The assistant connection ended before the response completed");
  }
}

export function streamConversationMessage(conversationId: string, content: string, handlers: ChatStreamHandlers): Promise<void> {
  return streamAssistant("/chat/stream", { conversation_id: conversationId, content }, handlers);
}

export function streamRegeneratedMessage(conversationId: string, assistantMessageId: string, handlers: ChatStreamHandlers): Promise<void> {
  return streamAssistant("/chat/regenerate/stream", {
    conversation_id: conversationId,
    assistant_message_id: assistantMessageId,
  }, handlers);
}
