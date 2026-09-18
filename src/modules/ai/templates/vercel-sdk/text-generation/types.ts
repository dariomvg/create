/**
 * Types for the Vercel AI SDK Text Generation module (Google provider).
 * Shared across service.ts, actions.ts and client.ts.
 */

// ---------------------------------------------------------------------------
// Model / provider configuration
// ---------------------------------------------------------------------------

/**
 * Default model and generation settings.
 * Override per-call via the `model` / `temperature` / `maxTokens` params.
 */
export const DEFAULT_MODEL = "gemini-1.5-pro";
export const DEFAULT_TEMPERATURE = 0.7;
export const DEFAULT_MAX_TOKENS = 1024;

/**
 * Simple in-memory rate limit guard applied before calling the provider.
 * Prevents hammering the API from a single server instance; this is not
 * a distributed limiter.
 */
export const RATE_LIMIT_CONFIG = {
  maxRequests: 20,
  windowMs: 60_000, // 1 minute
};

// ---------------------------------------------------------------------------
// Generate text
// ---------------------------------------------------------------------------

export interface GenerateTextParams {
  /** The user prompt sent to the model. */
  prompt: string;
  /** Optional system prompt to steer the model's behavior. */
  system?: string;
  /** Sampling temperature. Defaults to DEFAULT_TEMPERATURE. */
  temperature?: number;
  /** Max tokens to generate. Defaults to DEFAULT_MAX_TOKENS. */
  maxTokens?: number;
  /** Model id override. Defaults to DEFAULT_MODEL. */
  model?: string;
}

export interface GenerateTextResult {
  text: string;
  finishReason: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

// ---------------------------------------------------------------------------
// Stream text
// ---------------------------------------------------------------------------

export interface StreamTextParams {
  prompt: string;
  system?: string;
  temperature?: number;
  maxTokens?: number;
  model?: string;
}

// ---------------------------------------------------------------------------
// Structured output
// ---------------------------------------------------------------------------

export interface GenerateStructuredParams<T = unknown> {
  prompt: string;
  system?: string;
  temperature?: number;
  maxTokens?: number;
  model?: string;
  /** Zod schema describing the expected output shape. */
  schema: import("zod").ZodType<T>;
}

export interface GenerateStructuredResult<T = unknown> {
  object: T;
  finishReason: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/**
 * Normalized error codes surfaced to the UI. Raw SDK/provider error
 * details are never exposed to the client.
 */
export type AIErrorCode =
  | "RATE_LIMITED"
  | "INVALID_REQUEST"
  | "PROVIDER_ERROR"
  | "UNKNOWN";

export interface AIServiceError {
  code: AIErrorCode;
  message: string;
  /** Seconds to wait before retrying. Only set when code is RATE_LIMITED. */
  retryAfter?: number;
}

/**
 * Standard result wrapper returned by every service/action/client function
 * so the UI can branch on `success` without try/catch.
 */
export type AIResult<T> =
  | { success: true; data: T }
  | { success: false; error: AIServiceError };
