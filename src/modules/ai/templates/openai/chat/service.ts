import "server-only";
import OpenAI from "openai";
import { getChatStore, ConversationNotFoundError } from "./store";
import { buildContextMessages } from "./context";
import {
  DEFAULT_CHAT_MODEL,
  DEFAULT_MAX_OUTPUT_TOKENS,
  MAX_ALLOWED_OUTPUT_TOKENS,
  DEFAULT_TEMPERATURE,
  DEFAULT_STT_MODEL,
  DEFAULT_TTS_MODEL,
  DEFAULT_TTS_VOICE,
  RATE_LIMIT_CONFIG,
  type ChatCompletionOptions,
  type ChatCompletionResult,
  type ChatMessage,
  type TranscribeAudioOptions,
  type TranscribeAudioResult,
  type SynthesizeSpeechOptions,
  type AIActionError,
} from "./types";

// ============================================================================
// OpenAI Chat — Service (internal)
// Direct SDK usage + store/context orchestration. Do not import from client
// components — use actions.ts (server) or client.ts (client) instead.
// ============================================================================

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (client) return client;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw toAIError({ code: "AUTH_ERROR" });
  }

  client = new OpenAI({ apiKey });
  return client;
}

// ---------------------------------------------------------------------------
// Error normalization
// ---------------------------------------------------------------------------

const AI_ERROR_CODES = [
  "RATE_LIMITED",
  "INVALID_REQUEST",
  "AUTH_ERROR",
  "TIMEOUT",
  "NOT_FOUND",
  "UNKNOWN",
];

function isAIActionError(source: unknown): source is AIActionError {
  return (
    typeof source === "object" &&
    source !== null &&
    "code" in source &&
    "message" in source &&
    "retryable" in source &&
    AI_ERROR_CODES.includes((source as { code: string }).code)
  );
}

function toAIError(source: unknown): AIActionError {
  if (isAIActionError(source)) {
    return source;
  }

  if (source instanceof ConversationNotFoundError) {
    return {
      code: "NOT_FOUND",
      message: source.message,
      retryable: false,
    };
  }

  if (
    typeof source === "object" &&
    source !== null &&
    "code" in source &&
    (source as { code: string }).code === "AUTH_ERROR"
  ) {
    return {
      code: "AUTH_ERROR",
      message: "OpenAI API key is missing or invalid. Check your server configuration.",
      retryable: false,
    };
  }

  if (source instanceof OpenAI.APIError) {
    if (source.status === 429) {
      const retryAfterHeader = source.headers?.["retry-after"];
      const retryAfter = retryAfterHeader
        ? Number(retryAfterHeader)
        : RATE_LIMIT_CONFIG.defaultRetryAfterSeconds;

      return {
        code: "RATE_LIMITED",
        message: "Too many requests right now. Please wait and try again.",
        retryable: true,
        retryAfter,
      };
    }

    if (source.status === 401 || source.status === 403) {
      return {
        code: "AUTH_ERROR",
        message: "OpenAI rejected the request credentials.",
        retryable: false,
      };
    }

    if (source.status === 400) {
      return {
        code: "INVALID_REQUEST",
        message: source.message || "The request was invalid.",
        retryable: false,
      };
    }
  }

  if (source instanceof Error && source.name === "APIConnectionTimeoutError") {
    return {
      code: "TIMEOUT",
      message: "The request to OpenAI timed out. Please try again.",
      retryable: true,
    };
  }

  return {
    code: "UNKNOWN",
    message: "Something went wrong while processing your request.",
    retryable: false,
  };
}

async function withRateLimitRetry<T>(fn: () => Promise<T>): Promise<T> {
  let attempt = 0;

  while (true) {
    try {
      return await fn();
    } catch (err) {
      const isRateLimit = err instanceof OpenAI.APIError && err.status === 429;

      if (!isRateLimit || attempt >= RATE_LIMIT_CONFIG.maxRetries) {
        throw toAIError(err);
      }

      const delay = RATE_LIMIT_CONFIG.baseRetryDelayMs * 2 ** attempt;
      await new Promise((resolve) => setTimeout(resolve, delay));
      attempt++;
    }
  }
}

function clampMaxTokens(value: number | undefined): number {
  const requested = value ?? DEFAULT_MAX_OUTPUT_TOKENS;
  return Math.min(requested, MAX_ALLOWED_OUTPUT_TOKENS);
}

// ---------------------------------------------------------------------------
// Chat completion (non-streaming)
// Persists both the user message and the assistant reply to the store.
// ---------------------------------------------------------------------------

export async function chatCompletion(
  options: ChatCompletionOptions
): Promise<ChatCompletionResult> {
  const store = getChatStore();
  const openai = getClient();

  const conversation = await store.getConversation(options.conversationId);
  if (!conversation) {
    throw new ConversationNotFoundError(options.conversationId);
  }

  const history = await store.getMessages(options.conversationId);
  const contextMessages = buildContextMessages({
    history,
    newUserMessage: options.message,
    systemPrompt: options.systemPrompt,
  });

  const completion = await withRateLimitRetry(() =>
    openai.chat.completions.create({
      model: options.model ?? DEFAULT_CHAT_MODEL,
      messages: contextMessages,
      temperature: options.temperature ?? DEFAULT_TEMPERATURE,
      max_tokens: clampMaxTokens(options.maxOutputTokens),
    })
  );

  const replyText = completion.choices[0]?.message?.content ?? "";

  // Persist both sides of the exchange.
  await store.addMessage(options.conversationId, { role: "user", content: options.message });
  const assistantMessage = await store.addMessage(options.conversationId, {
    role: "assistant",
    content: replyText,
  });

  return {
    message: assistantMessage,
    model: completion.model,
    usage: completion.usage
      ? {
          promptTokens: completion.usage.prompt_tokens,
          completionTokens: completion.usage.completion_tokens,
          totalTokens: completion.usage.total_tokens,
        }
      : undefined,
  };
}

// ---------------------------------------------------------------------------
// Stream chat completion
// Returns the raw OpenAI stream. The caller (stream/handler.ts) is
// responsible for turning this into a ReadableStream and for persisting the
// final assistant message once the stream completes.
// ---------------------------------------------------------------------------

export async function streamChatCompletion(options: ChatCompletionOptions) {
  const store = getChatStore();
  const openai = getClient();

  const conversation = await store.getConversation(options.conversationId);
  if (!conversation) {
    throw new ConversationNotFoundError(options.conversationId);
  }

  const history = await store.getMessages(options.conversationId);
  const contextMessages = buildContextMessages({
    history,
    newUserMessage: options.message,
    systemPrompt: options.systemPrompt,
  });

  try {
    const openaiStream = await openai.chat.completions.create({
      model: options.model ?? DEFAULT_CHAT_MODEL,
      messages: contextMessages,
      temperature: options.temperature ?? DEFAULT_TEMPERATURE,
      max_tokens: clampMaxTokens(options.maxOutputTokens),
      stream: true,
    });

    // The user message is known upfront — persist it immediately.
    // The assistant reply is persisted by stream/handler.ts once complete.
    await store.addMessage(options.conversationId, { role: "user", content: options.message });

    return openaiStream;
  } catch (err) {
    throw toAIError(err);
  }
}

/** Persists the assistant's full reply once a stream finishes. Called by stream/handler.ts. */
export async function persistAssistantReply(
  conversationId: string,
  content: string
): Promise<ChatMessage> {
  const store = getChatStore();
  return store.addMessage(conversationId, { role: "assistant", content });
}

// ---------------------------------------------------------------------------
// Conversation management
// Thin, error-normalized wrappers around the store — actions.ts should go
// through these instead of importing store.ts directly.
// ---------------------------------------------------------------------------

export async function createConversation(title?: string) {
  const store = getChatStore();
  return store.createConversation(title);
}

export async function listConversations() {
  const store = getChatStore();
  return store.listConversations();
}

export async function getConversationWithMessages(conversationId: string) {
  const store = getChatStore();

  const conversation = await store.getConversation(conversationId);
  if (!conversation) {
    throw new ConversationNotFoundError(conversationId);
  }

  const messages = await store.getMessages(conversationId);
  return { conversation, messages };
}

export async function renameConversation(conversationId: string, title: string) {
  const store = getChatStore();
  return store.renameConversation(conversationId, title);
}

export async function deleteConversation(conversationId: string) {
  const store = getChatStore();
  return store.deleteConversation(conversationId);
}

// ---------------------------------------------------------------------------
// Speech-to-text
// ---------------------------------------------------------------------------

export async function transcribeAudio(
  options: TranscribeAudioOptions
): Promise<TranscribeAudioResult> {
  const openai = getClient();

  const transcription = await withRateLimitRetry(() =>
    openai.audio.transcriptions.create({
      file: options.file,
      model: options.model ?? DEFAULT_STT_MODEL,
      language: options.language,
    })
  );

  return { text: transcription.text };
}

// ---------------------------------------------------------------------------
// Text-to-speech
// Returns the raw OpenAI response so audio/handler.ts can stream its body
// straight through to the client.
// ---------------------------------------------------------------------------

export async function synthesizeSpeech(options: SynthesizeSpeechOptions) {
  const openai = getClient();

  try {
    return await openai.audio.speech.create({
      model: options.model ?? DEFAULT_TTS_MODEL,
      voice: options.voice ?? DEFAULT_TTS_VOICE,
      input: options.text,
    });
  } catch (err) {
    throw toAIError(err);
  }
}

export { toAIError };
