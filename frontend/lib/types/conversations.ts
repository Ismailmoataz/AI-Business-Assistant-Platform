import type { Page } from "@/lib/types/api";

export type MessageRole = "system" | "user" | "assistant";

export interface Citation {
  document_id: string;
  title: string;
  filename: string;
  chunk_index: number;
  similarity_score: number;
}

export interface ConversationMessage {
  id: string;
  conversation_id: string;
  role: MessageRole;
  content: string;
  citations: Citation[];
  created_at: string;
}

export interface Conversation {
  id: string;
  company_id: string;
  owner_id: string;
  title: string | null;
  last_message_preview: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConversationDetail extends Conversation {
  messages: ConversationMessage[];
}

export type ConversationPage = Page<Conversation>;

export interface ChatStreamCompletion {
  message_id: string;
  citations: Citation[];
}

export interface ChatStreamHandlers {
  signal: AbortSignal;
  onToken: (token: string) => void;
  onComplete: (completion: ChatStreamCompletion) => void;
}
