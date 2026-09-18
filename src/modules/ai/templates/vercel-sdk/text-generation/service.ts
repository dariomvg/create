/**
 * Internal service logic for the Vercel AI SDK Text Generation module.
 * Not meant to be imported directly by consumers — use actions.ts (server)
 * or client.ts (client) instead.
 */

import { generateText, streamText, generateObject, APICallError } from "ai";
import { google } from "@ai-sdk/google";
import type {
  GenerateTextParams,
  GenerateTextResult,
  StreamTextParams,
  GenerateStructuredParams,
  GenerateStructuredResult,
  AIResult,
  AIServiceError,
} from "./types";
import {
  DEFAULT_MODEL,
  DEFAULT_TEMPERATURE,
  DEFAULT_MAX_TOKENS,
  RATE_LIMIT_CONFIG,
} from "./types";

// ---------------------------------------------------------------------------
// In-memory rate limiter
// ---------------------------------------------------------------------------

/**
 * Timestamps (ms) of recent requests, used for a simple sliding-window
 * rate limit. Per-server-instance only — not shared across instances.
 */
const requestTimestamps: number[] = [];

function checkRateLimit(): AIServiceError | null {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_CONFIG.windowMs;

  // Drop timestamps outside the current window.
  while (requestTimestamps.length > 0 && requestTimestamps[0] < windowStart) {
    requestTimestamps.shift();
  }

  if (requestTimestamps.length >= RATE_LIMIT_CONFIG.maxRequests) {
    const retryAfter = Math.ceil(
      (requestTimestamps[0] + RATE_LIMIT_CONFIG.windowMs - now) / 1000
    );
    return {
      code: "RATE_LIMITED",
      message: "Too many requests. Please wait before trying again.",
      retryAfter: Math.max(retryAfter, 1),
    };
  }

  requestTimestamps.push(now);
  return null;
}

// ---------------------------------------------------------------------------
// Error normalization
// ---------------------------------------------------------------------------

/**
 * Converts any thrown error (SDK or provider) into a normalized
 * AIServiceError, safe to forward to the UI. Never leaks raw SDK/provider
 * error details.
 */
function normalizeError(error: unknown): AIServiceError {
  if (APICallError.isInstance(error)) {
    if (error.statusCode === 429) {
      const retryAfterHeader = error.responseHeaders?.["retry-after"];
      return {
        code: "RATE_LIMITED",
        message: "The provider rate-limited this request. Please try again shortly.",
        retryAfter: retryAfterHeader ? Number(retryAfterHeader) : undefined,
      };
    }

    if (error.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
      return {
        code: "INVALID_REQUEST",
        message: "The request was rejected by the provider. Please check the input.",
      };
    }

    return {
      code: "PROVIDER_ERROR",
      message: "The AI provider is currently unavailable. Please try again later.",
    };
  }

  return {
    code: "UNKNOWN",
    message: "Something went wrong while generating a response.",
  };
}

// ---------------------------------------------------------------------------
// Generate text
// ---------------------------------------------------------------------------

export async function generateTextService(
  params: GenerateTextParams
): Promise<AIResult<GenerateTextResult>> {
  const rateLimitError = checkRateLimit();
  if (rateLimitError) return { success: false, error: rateLimitError };

  try {
    const result = await generateText({
      model: google(params.model ?? DEFAULT_MODEL),
      system: params.system,
      prompt: params.prompt,
      temperature: params.temperature ?? DEFAULT_TEMPERATURE,
      maxOutputTokens: params.maxTokens ?? DEFAULT_MAX_TOKENS,
    });

    return {
      success: true,
      data: {
        text: result.text,
        finishReason: result.finishReason,
        usage: {
          promptTokens: result.usage.inputTokens ?? 0,
          completionTokens: result.usage.outputTokens ?? 0,
          totalTokens: result.usage.totalTokens ?? 0,
        },
      },
    };
  } catch (error) {
    return { success: false, error: normalizeError(error) };
  }
}

// ---------------------------------------------------------------------------
// Stream text
// ---------------------------------------------------------------------------

/**
 * Returns the raw AI SDK stream result on success so the caller
 * (stream/handler.ts) can pipe it into a Response. Pre-flight checks
 * (rate limit) happen here; mid-stream errors are handled by the caller
 * since they surface while consuming the stream, not on this call.
 */
export function streamTextService(
  params: StreamTextParams
): AIResult<ReturnType<typeof streamText>> {
  const rateLimitError = checkRateLimit();
  if (rateLimitError) return { success: false, error: rateLimitError };

  const result = streamText({
    model: google(params.model ?? DEFAULT_MODEL),
    system: params.system,
    prompt: params.prompt,
    temperature: params.temperature ?? DEFAULT_TEMPERATURE,
    maxOutputTokens: params.maxTokens ?? DEFAULT_MAX_TOKENS,
  });

  return { success: true, data: result };
}

/** Normalizes a mid-stream error. Exposed for stream/handler.ts to use. */
export { normalizeError as normalizeStreamError };

// ---------------------------------------------------------------------------
// Structured output
// ---------------------------------------------------------------------------

export async function generateStructuredService<T>(
  params: GenerateStructuredParams<T>
): Promise<AIResult<GenerateStructuredResult<T>>> {
  const rateLimitError = checkRateLimit();
  if (rateLimitError) return { success: false, error: rateLimitError };

  try {
    const result = await generateObject({
      model: google(params.model ?? DEFAULT_MODEL),
      system: params.system,
      prompt: params.prompt,
      temperature: params.temperature ?? DEFAULT_TEMPERATURE,
      maxOutputTokens: params.maxTokens ?? DEFAULT_MAX_TOKENS,
      schema: params.schema,
    });

    return {
      success: true,
      data: {
        object: result.object,
        finishReason: result.finishReason,
        usage: {
          promptTokens: result.usage.inputTokens ?? 0,
          completionTokens: result.usage.outputTokens ?? 0,
          totalTokens: result.usage.totalTokens ?? 0,
        },
      },
    };
  } catch (error) {
    return { success: false, error: normalizeError(error) };
  }
}
