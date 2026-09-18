/**
 * Types for the Vercel AI SDK Chat module (Google provider).
 * Shared across service.ts, store.ts, actions.ts and client.ts.
 *
 * Standalone module — does not import anything from the
 * text-generation module, even though some shapes look similar.
 */

// ---------------------------------------------------------------------------
// Model / provider configuration
// ---------------------------------------------------------------------------

export const DEFAULT_MODEL = "gemini-1.5-pro";
export const DEFAULT_TEMPERATURE = 0.7;
export const DEFAULT_MAX_TOKENS = 1024;

/** Simple in-memory rate limit guard. Per-server-instance only. */
export const RATE_LIMIT_CONFIG = {
  maxRequests: 20,
  windowMs: 60_000, // 1 minute
};

/**
 * Context management: how much conversation history is sent to the model
 * on each turn. Kept simple — a message count cap, not a token counter,
 * to avoid pulling in a tokenizer dependency.
 */
export const CONTEXT_CONFIG = {
  maxMessages: 20,
};

// ---------------------------------------------------------------------------
// Messages & conversations
// ---------------------------------------------------------------------------

export type MessageRole = "user" | "assistant" | "system";

export interface Message {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  createdAt: string; // ISO timestamp
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
}

// ---------------------------------------------------------------------------
// Chat completion
// ---------------------------------------------------------------------------

export interface ChatCompletionParams {
  conversationId: string;
  /** The new user message to send. */
  message: string;
  system?: string;
  temperature?: number;
  maxTokens?: number;
  model?: string;
}

export interface ChatCompletionResult {
  message: Message;
  finishReason: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

// ---------------------------------------------------------------------------
// Chat streaming
// ---------------------------------------------------------------------------

export interface ChatStreamParams {
  conversationId: string;
  message: string;
  system?: string;
  temperature?: number;
  maxTokens?: number;
  model?: string;
}

// ---------------------------------------------------------------------------
// Conversation persistence contract (implemented by the consumer)
// ---------------------------------------------------------------------------

/**
 * Storage contract for conversations and messages. This module ships no
 * implementation — register one (backed by Supabase, Prisma, or anything
 * else) via store.ts's registerConversationStore() during app startup.
 */
export interface ConversationStore {
  createConversation(title?: string): Promise<Conversation>;
  getConversation(id: string): Promise<Conversation | null>;
  listConversations(): Promise<Conversation[]>;
  renameConversation(id: string, title: string): Promise<void>;
  deleteConversation(id: string): Promise<void>;
  addMessage(message: Message): Promise<void>;
  /** Most recent messages first is not required — callers sort as needed. */
  getMessages(conversationId: string): Promise<Message[]>;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export type AIErrorCode =
  | "RATE_LIMITED"
  | "INVALID_REQUEST"
  | "PROVIDER_ERROR"
  | "STORE_NOT_CONFIGURED"
  | "NOT_IMPLEMENTED"
  | "UNKNOWN";

export interface AIServiceError {
  code: AIErrorCode;
  message: string;
  /** Seconds to wait before retrying. Only set when code is RATE_LIMITED. */
  retryAfter?: number;
}

export type AIResult<T> =
  | { success: true; data: T }
  | { success: false; error: AIServiceError };
