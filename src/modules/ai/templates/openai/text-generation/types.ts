// ============================================================================
// OpenAI Text Generation — Types
// ============================================================================

// ---------------------------------------------------------------------------
// Default configuration
// (Token limits and default model live here instead of a separate constants
// file — this is the single source of truth for generation defaults.)
// ---------------------------------------------------------------------------

export const DEFAULT_MODEL = "gpt-4o-mini";

export const DEFAULT_MAX_OUTPUT_TOKENS = 1024;

export const MAX_ALLOWED_OUTPUT_TOKENS = 4096;

export const DEFAULT_TEMPERATURE = 0.7;

// ---------------------------------------------------------------------------
// Rate limit configuration
// Used by service.ts to decide retry behavior when OpenAI returns a 429.
// ---------------------------------------------------------------------------

export const RATE_LIMIT_CONFIG = {
  /** Max automatic retries on a 429 before giving up and surfacing the error. */
  maxRetries: 2,
  /** Base delay (ms) for exponential backoff between retries. */
  baseRetryDelayMs: 500,
  /** Fallback wait time (seconds) to report to the UI when OpenAI doesn't send one. */
  defaultRetryAfterSeconds: 20,
} as const;

// ---------------------------------------------------------------------------
// Generation options (shared by generateText / streamText)
// ---------------------------------------------------------------------------

export interface GenerateTextOptions {
  /** The user prompt / message content. */
  prompt: string;
  /** Optional system prompt to steer model behavior. */
  systemPrompt?: string;
  /** Model to use. Defaults to DEFAULT_MODEL. */
  model?: string;
  /** Sampling temperature (0-2). Defaults to DEFAULT_TEMPERATURE. */
  temperature?: number;
  /** Max tokens to generate. Defaults to DEFAULT_MAX_OUTPUT_TOKENS, capped at MAX_ALLOWED_OUTPUT_TOKENS. */
  maxOutputTokens?: number;
}

export interface GenerateTextResult {
  text: string;
  model: string;
  /** Token usage reported by OpenAI, when available. */
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

// ---------------------------------------------------------------------------
// Structured output
// ---------------------------------------------------------------------------

export interface GenerateStructuredOutputOptions extends GenerateTextOptions {
  /**
   * JSON Schema describing the expected output shape.
   * Passed to OpenAI's structured output (response_format: json_schema).
   */
  schema: Record<string, unknown>;
  /** Name identifying the schema (required by the OpenAI API). */
  schemaName: string;
}

export interface GenerateStructuredOutputResult<T = unknown> {
  data: T;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

// ---------------------------------------------------------------------------
// Normalized error handling
// Every service/action/client function returns or throws this shape so the
// UI never has to deal with raw OpenAI SDK error objects.
// ---------------------------------------------------------------------------

export type AIErrorCode =
  | "RATE_LIMITED"
  | "INVALID_REQUEST"
  | "AUTH_ERROR"
  | "TIMEOUT"
  | "UNKNOWN";

export interface AIActionError {
  code: AIErrorCode;
  message: string;
  /** Whether the caller can reasonably retry (e.g. rate limit, timeout). */
  retryable: boolean;
  /** Seconds to wait before retrying. Only set when code is RATE_LIMITED. */
  retryAfter?: number;
}

// ---------------------------------------------------------------------------
// Result wrapper used across actions.ts / client.ts
// Avoids throwing across the server/client boundary — callers check `ok`.
// ---------------------------------------------------------------------------

export type AIActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: AIActionError };
