/**
 * Internal service layer for the Anthropic Chat module.
 *
 * This file contains all direct interaction with the Anthropic SDK and the
 * ChatStore. Consumers should NOT import from here directly — use
 * actions.ts (server) or client.ts (client) instead.
 */

import Anthropic from "@anthropic-ai/sdk";
import { getChatStore } from "./store";
import type {
  AIError,
  AIResult,
  ChatCompletionResult,
  ChatMessage,
  GenerationOptions,
} from "./types";
import {
  DEFAULT_MODEL,
  DEFAULT_MAX_TOKENS,
  DEFAULT_TEMPERATURE,
  DEFAULT_MAX_CONTEXT_TOKENS,
  RATE_LIMIT_DEFAULT_RETRY_AFTER_SECONDS,
} from "./types";

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error(
        "Missing ANTHROPIC_API_KEY environment variable. Check SETUP.md."
      );
    }
    client = new Anthropic({ apiKey });
  }
  return client;
}

// ---------------------------------------------------------------------------
// Error normalization (same pattern as the Text Generation module)
// ---------------------------------------------------------------------------

function normalizeError(err: unknown): AIError {
  if (err instanceof Anthropic.APIError) {
    const status = err.status;

    if (status === 401 || status === 403) {
      return {
        code: "authentication_error",
        message: "Authentication failed. Check your ANTHROPIC_API_KEY.",
      };
    }

    if (status === 429) {
      const retryAfterHeader = err.headers?.["retry-after"];
      const retryAfter = retryAfterHeader
        ? Number(retryAfterHeader)
        : RATE_LIMIT_DEFAULT_RETRY_AFTER_SECONDS;

      return {
        code: "rate_limited",
        message: "Rate limit exceeded. Please try again shortly.",
        retryAfter,
      };
    }

    if (status === 529) {
      return {
        code: "overloaded",
        message: "The model is temporarily overloaded. Please try again.",
      };
    }

    if (status === 400) {
      return {
        code: "invalid_request",
        message: err.message || "Invalid request sent to the model.",
      };
    }

    return { code: "unknown_error", message: err.message || "An unexpected error occurred." };
  }

  if (err instanceof Anthropic.APIConnectionError) {
    return {
      code: "network_error",
      message: "Could not reach the Anthropic API. Check your connection.",
    };
  }

  return {
    code: "unknown_error",
    message: err instanceof Error ? err.message : "An unexpected error occurred.",
  };
}

export function normalizeStreamError(err: unknown): AIError {
  return normalizeError(err);
}

// ---------------------------------------------------------------------------
// Context management
// ---------------------------------------------------------------------------

function toApiMessages(messages: ChatMessage[]): Anthropic.MessageParam[] {
  return messages.map((m) => ({ role: m.role, content: m.content }));
}

/**
 * Trims the oldest messages from history until the conversation fits within
 * maxContextTokens, using the real countTokens endpoint rather than a
 * hand-rolled estimate. Always keeps at least the most recent message.
 */
async function trimToContextWindow(
  anthropic: Anthropic,
  model: string,
  systemPrompt: string | undefined,
  messages: ChatMessage[],
  maxContextTokens: number
): Promise<Anthropic.MessageParam[]> {
  let working = [...messages];

  while (working.length > 1) {
    const { input_tokens } = await anthropic.messages.countTokens({
      model,
      system: systemPrompt,
      messages: toApiMessages(working),
    });

    if (input_tokens <= maxContextTokens) break;
    working = working.slice(1); // drop oldest message
  }

  return toApiMessages(working);
}

// ---------------------------------------------------------------------------
// Shared prep: validates the conversation, persists the user message, and
// builds the trimmed message list to send to the API.
// ---------------------------------------------------------------------------

interface PreparedChat {
  apiMessages: Anthropic.MessageParam[];
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt?: string;
}

async function prepareChat(
  conversationId: string,
  content: string,
  options?: GenerationOptions
): Promise<AIResult<PreparedChat>> {
  const store = getChatStore();
  const conversation = await store.getConversation(conversationId);

  if (!conversation) {
    return {
      error: { code: "not_found", message: `Conversation "${conversationId}" not found.` },
    };
  }

  const userMessage: ChatMessage = {
    id: crypto.randomUUID(),
    role: "user",
    content,
    createdAt: new Date().toISOString(),
  };
  await store.addMessage(conversationId, userMessage);

  const model = options?.model ?? DEFAULT_MODEL;
  const anthropic = getClient();
  const history = [...conversation.messages, userMessage];

  const apiMessages = await trimToContextWindow(
    anthropic,
    model,
    options?.systemPrompt,
    history,
    options?.maxContextTokens ?? DEFAULT_MAX_CONTEXT_TOKENS
  );

  return {
    data: {
      apiMessages,
      model,
      temperature: options?.temperature ?? DEFAULT_TEMPERATURE,
      maxTokens: options?.maxTokens ?? DEFAULT_MAX_TOKENS,
      systemPrompt: options?.systemPrompt,
    },
  };
}

// ---------------------------------------------------------------------------
// Chat completion (non-streaming)
// ---------------------------------------------------------------------------

export async function chatCompletionService(
  conversationId: string,
  content: string,
  options?: GenerationOptions
): Promise<AIResult<ChatCompletionResult>> {
  try {
    const prepared = await prepareChat(conversationId, content, options);
    if (prepared.error) return { error: prepared.error };

    const anthropic = getClient();
    const { apiMessages, model, temperature, maxTokens, systemPrompt } = prepared.data;

    const response = await anthropic.messages.create({
      model,
      max_tokens: maxTokens,
      temperature,
      system: systemPrompt,
      messages: apiMessages,
    });

    const textBlock = response.content.find((block) => block.type === "text");
    const assistantMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: textBlock?.type === "text" ? textBlock.text : "",
      createdAt: new Date().toISOString(),
    };

    await getChatStore().addMessage(conversationId, assistantMessage);

    return {
      data: {
        message: assistantMessage,
        model: response.model,
        stopReason: response.stop_reason,
        usage: {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
        },
      },
    };
  } catch (err) {
    return { error: normalizeError(err) };
  }
}

// ---------------------------------------------------------------------------
// Streaming chat completion
// ---------------------------------------------------------------------------

/**
 * Prepares and starts a streamed chat completion. Returns the raw Anthropic
 * MessageStream (or a normalized error, e.g. conversation not found) so
 * stream/handler.ts can pipe text deltas to the client and persist the
 * final assistant message once the stream completes.
 */
export async function streamChatService(
  conversationId: string,
  content: string,
  options?: GenerationOptions
): Promise<AIResult<{ stream: ReturnType<Anthropic["messages"]["stream"]> }>> {
  const prepared = await prepareChat(conversationId, content, options);
  if (prepared.error) return { error: prepared.error };

  const anthropic = getClient();
  const { apiMessages, model, temperature, maxTokens, systemPrompt } = prepared.data;

  const stream = anthropic.messages.stream({
    model,
    max_tokens: maxTokens,
    temperature,
    system: systemPrompt,
    messages: apiMessages,
  });

  return { data: { stream } };
}

/** Persists the assistant's full response once a stream completes. */
export async function persistAssistantMessage(
  conversationId: string,
  content: string
): Promise<void> {
  const assistantMessage: ChatMessage = {
    id: crypto.randomUUID(),
    role: "assistant",
    content,
    createdAt: new Date().toISOString(),
  };
  await getChatStore().addMessage(conversationId, assistantMessage);
}
