import "server-only";
import OpenAI from "openai";
import {
  DEFAULT_MODEL,
  DEFAULT_MAX_OUTPUT_TOKENS,
  MAX_ALLOWED_OUTPUT_TOKENS,
  DEFAULT_TEMPERATURE,
  RATE_LIMIT_CONFIG,
  type GenerateTextOptions,
  type GenerateTextResult,
  type GenerateStructuredOutputOptions,
  type GenerateStructuredOutputResult,
  type AIActionError,
} from "./types";

// ============================================================================
// OpenAI Text Generation — Service (internal)
// This file holds all direct SDK usage. Do not import it from client
// components — use actions.ts (server) or client.ts (client) instead.
// ============================================================================

let client: OpenAI | null = null;

/**
 * Lazily creates a single OpenAI client instance per server runtime.
 * Throws a normalized AIActionError if the API key is missing.
 */
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

/**
 * Converts any thrown value (typically an OpenAI SDK error) into the
 * normalized AIActionError shape used across the whole module.
 */
const AI_ERROR_CODES = ["RATE_LIMITED", "INVALID_REQUEST", "AUTH_ERROR", "TIMEOUT", "UNKNOWN"];

/** True if `source` is already a normalized AIActionError (avoids double-wrapping). */
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
  // Already normalized upstream (e.g. re-caught in actions.ts) — pass through as-is.
  if (isAIActionError(source)) {
    return source;
  }

  // Manual override, e.g. missing API key before the SDK is even called.
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
    message: "Something went wrong while generating a response.",
    retryable: false,
  };
}

/**
 * Runs an OpenAI call with automatic retry + backoff on rate limit (429)
 * errors, up to RATE_LIMIT_CONFIG.maxRetries. Any other error is normalized
 * and thrown immediately.
 */
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

function buildMessages(options: GenerateTextOptions): OpenAI.ChatCompletionMessageParam[] {
  const messages: OpenAI.ChatCompletionMessageParam[] = [];

  if (options.systemPrompt) {
    messages.push({ role: "system", content: options.systemPrompt });
  }

  messages.push({ role: "user", content: options.prompt });

  return messages;
}

// ---------------------------------------------------------------------------
// Generate text (non-streaming)
// ---------------------------------------------------------------------------

export async function generateText(
  options: GenerateTextOptions
): Promise<GenerateTextResult> {
  const openai = getClient();

  const completion = await withRateLimitRetry(() =>
    openai.chat.completions.create({
      model: options.model ?? DEFAULT_MODEL,
      messages: buildMessages(options),
      temperature: options.temperature ?? DEFAULT_TEMPERATURE,
      max_tokens: clampMaxTokens(options.maxOutputTokens),
    })
  );

  const text = completion.choices[0]?.message?.content ?? "";

  return {
    text,
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
// Stream text
// Returns the raw OpenAI stream. The route handler (stream/handler.ts) is
// responsible for turning this into a ReadableStream for the HTTP response.
// ---------------------------------------------------------------------------

export async function streamText(options: GenerateTextOptions) {
  const openai = getClient();

  try {
    return await openai.chat.completions.create({
      model: options.model ?? DEFAULT_MODEL,
      messages: buildMessages(options),
      temperature: options.temperature ?? DEFAULT_TEMPERATURE,
      max_tokens: clampMaxTokens(options.maxOutputTokens),
      stream: true,
    });
  } catch (err) {
    throw toAIError(err);
  }
}

// ---------------------------------------------------------------------------
// Structured output
// ---------------------------------------------------------------------------

export async function generateStructuredOutput<T = unknown>(
  options: GenerateStructuredOutputOptions
): Promise<GenerateStructuredOutputResult<T>> {
  const openai = getClient();

  const completion = await withRateLimitRetry(() =>
    openai.chat.completions.create({
      model: options.model ?? DEFAULT_MODEL,
      messages: buildMessages(options),
      temperature: options.temperature ?? DEFAULT_TEMPERATURE,
      max_tokens: clampMaxTokens(options.maxOutputTokens),
      response_format: {
        type: "json_schema",
        json_schema: {
          name: options.schemaName,
          schema: options.schema,
          strict: true,
        },
      },
    })
  );

  const raw = completion.choices[0]?.message?.content ?? "{}";

  let data: T;
  try {
    data = JSON.parse(raw) as T;
  } catch {
    throw toAIError(new OpenAI.APIError(400, undefined, "Model returned invalid JSON.", undefined));
  }

  return {
    data,
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

// Exposed so actions.ts / stream/handler.ts can normalize errors the same way.
export { toAIError };
