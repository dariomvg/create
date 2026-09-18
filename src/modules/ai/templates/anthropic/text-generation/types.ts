/**
 * Shared types for the Anthropic Text Generation module.
 * This file has no side effects and can be safely imported from
 * server or client code.
 */

// ---------------------------------------------------------------------------
// Model / generation configuration
// ---------------------------------------------------------------------------

/**
 * Default model used when no model is explicitly provided.
 * Update this constant if you want to change the default across the module.
 */
export const DEFAULT_MODEL = "claude-sonnet-4-6";

/** Default max_tokens used when no value is explicitly provided. */
export const DEFAULT_MAX_TOKENS = 1024;

/** Default temperature used when no value is explicitly provided. */
export const DEFAULT_TEMPERATURE = 1;

/**
 * Options accepted by generateText / streamText.
 * All fields are optional and fall back to the DEFAULT_* constants above.
 */
export interface GenerationOptions {
  /** Model ID to use (e.g. "claude-sonnet-4-6"). */
  model?: string;
  /** System prompt that sets context/behavior for the model. */
  systemPrompt?: string;
  /** Sampling temperature (0-1). Lower = more deterministic. */
  temperature?: number;
  /** Maximum number of tokens to generate. */
  maxTokens?: number;
}

// ---------------------------------------------------------------------------
// Text generation
// ---------------------------------------------------------------------------

/** Successful result of a non-streaming text generation call. */
export interface GenerateTextResult {
  /** The generated text content. */
  text: string;
  /** Model that produced the response. */
  model: string;
  /** Reason the model stopped generating (e.g. "end_turn", "max_tokens"). */
  stopReason: string | null;
  /** Token usage reported by the API. */
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
}

// ---------------------------------------------------------------------------
// Structured output
// ---------------------------------------------------------------------------

/**
 * Options for generateStructuredOutput. Extends GenerationOptions with the
 * JSON schema the model's output must conform to.
 */
export interface StructuredOutputOptions extends GenerationOptions {
  /**
   * Name describing the output shape (used internally as a tool name).
   * Keep it short and descriptive, e.g. "extract_contact_info".
   */
  schemaName: string;
  /** JSON schema (subset supported by Anthropic tool input schemas). */
  schema: Record<string, unknown>;
}

/** Successful result of a structured output call. */
export interface GenerateStructuredOutputResult<T = unknown> {
  /** Parsed object matching the provided schema. */
  data: T;
  /** Model that produced the response. */
  model: string;
  /** Token usage reported by the API. */
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
}

// ---------------------------------------------------------------------------
// Streaming
// ---------------------------------------------------------------------------

/** A single chunk of streamed text delivered to the client. */
export interface StreamChunk {
  /** Incremental piece of generated text. */
  text: string;
}

/** Payload sent to the streaming API route. */
export interface StreamRequestBody {
  prompt: string;
  options?: GenerationOptions;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/**
 * Normalized error codes surfaced to the UI. Keeps consumers from having to
 * branch on raw Anthropic SDK error shapes.
 */
export type AIErrorCode =
  | "invalid_request"
  | "authentication_error"
  | "rate_limited"
  | "overloaded"
  | "network_error"
  | "unknown_error";

/**
 * Normalized error shape returned by service/actions/client instead of
 * throwing raw SDK errors. Safe to render directly in the UI.
 */
export interface AIError {
  code: AIErrorCode;
  message: string;
  /** Present only when code === "rate_limited" and the API provided a value. */
  retryAfter?: number;
}

/** Standard result wrapper used by all actions.ts / client.ts functions. */
export type AIResult<T> = { data: T; error?: never } | { data?: never; error: AIError };

// ---------------------------------------------------------------------------
// Rate limit config (used by service.ts to interpret 429 responses)
// ---------------------------------------------------------------------------

export const RATE_LIMIT_DEFAULT_RETRY_AFTER_SECONDS = 30;
