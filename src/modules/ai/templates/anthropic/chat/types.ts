/**
 * Shared types for the Anthropic Chat module.
 * This file has no side effects and can be safely imported from
 * server or client code.
 */

// ---------------------------------------------------------------------------
// Model / generation configuration
// ---------------------------------------------------------------------------

export const DEFAULT_MODEL = "claude-sonnet-4-6";
export const DEFAULT_MAX_TOKENS = 1024;
export const DEFAULT_TEMPERATURE = 1;

/**
 * Maximum number of input tokens to keep in a conversation's context
 * before older messages get trimmed. See service.ts's context management
 * logic for how this is enforced.
 */
export const DEFAULT_MAX_CONTEXT_TOKENS = 150_000;

export interface GenerationOptions {
  model?: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  /** Overrides DEFAULT_MAX_CONTEXT_TOKENS for this call. */
  maxContextTokens?: number;
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

export type MessageRole = "user" | "assistant";

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Conversations
// ---------------------------------------------------------------------------

export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

/** Conversation together with its full message history. */
export interface ConversationWithMessages extends Conversation {
  messages: ChatMessage[];
}

// ---------------------------------------------------------------------------
// Chat completion results
// ---------------------------------------------------------------------------

export interface ChatCompletionResult {
  message: ChatMessage;
  model: string;
  stopReason: string | null;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
}

// ---------------------------------------------------------------------------
// Streaming
// ---------------------------------------------------------------------------

export interface StreamChunk {
  text: string;
}

export interface StreamChatRequestBody {
  conversationId: string;
  content: string;
  options?: GenerationOptions;
}

// ---------------------------------------------------------------------------
// Errors (same normalized shape as the Text Generation module)
// ---------------------------------------------------------------------------

export type AIErrorCode =
  | "invalid_request"
  | "authentication_error"
  | "rate_limited"
  | "overloaded"
  | "network_error"
  | "not_found"
  | "unknown_error";

export interface AIError {
  code: AIErrorCode;
  message: string;
  retryAfter?: number;
}

export type AIResult<T> = { data: T; error?: never } | { data?: never; error: AIError };

export const RATE_LIMIT_DEFAULT_RETRY_AFTER_SECONDS = 30;
