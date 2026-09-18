/**
 * Internal service layer for the Anthropic Text Generation module.
 *
 * This file contains all direct interaction with the Anthropic SDK.
 * Consumers of this module should NOT import from here directly —
 * use actions.ts (server) or client.ts (client) instead.
 */

import Anthropic from "@anthropic-ai/sdk";
import type {
  AIError,
  AIResult,
  GenerationOptions,
  GenerateTextResult,
  StructuredOutputOptions,
  GenerateStructuredOutputResult,
} from "./types";
import {
  DEFAULT_MODEL,
  DEFAULT_MAX_TOKENS,
  DEFAULT_TEMPERATURE,
  RATE_LIMIT_DEFAULT_RETRY_AFTER_SECONDS,
} from "./types";

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

let client: Anthropic | null = null;

/** Lazily creates and reuses a single Anthropic client instance. */
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
// Error normalization
// ---------------------------------------------------------------------------

/**
 * Converts any error thrown by the Anthropic SDK into the module's
 * normalized AIError shape, so callers never have to branch on raw
 * SDK error classes.
 */
function normalizeError(err: unknown): AIError {
  // SDK errors expose a `status` property (HTTP status code).
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

    return {
      code: "unknown_error",
      message: err.message || "An unexpected error occurred.",
    };
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

// ---------------------------------------------------------------------------
// Text generation
// ---------------------------------------------------------------------------

export async function generateTextService(
  prompt: string,
  options?: GenerationOptions
): Promise<AIResult<GenerateTextResult>> {
  try {
    const anthropic = getClient();

    const response = await anthropic.messages.create({
      model: options?.model ?? DEFAULT_MODEL,
      max_tokens: options?.maxTokens ?? DEFAULT_MAX_TOKENS,
      temperature: options?.temperature ?? DEFAULT_TEMPERATURE,
      system: options?.systemPrompt,
      messages: [{ role: "user", content: prompt }],
    });

    const textBlock = response.content.find((block) => block.type === "text");

    return {
      data: {
        text: textBlock?.type === "text" ? textBlock.text : "",
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
// Streaming text generation
// ---------------------------------------------------------------------------

/**
 * Returns the raw Anthropic MessageStream so the route handler can pipe
 * text deltas to the client as they arrive. Errors thrown here are caught
 * by the caller (stream/handler.ts) since streaming errors can surface
 * mid-stream, not just on initiation.
 */
export function streamTextService(prompt: string, options?: GenerationOptions) {
  const anthropic = getClient();

  return anthropic.messages.stream({
    model: options?.model ?? DEFAULT_MODEL,
    max_tokens: options?.maxTokens ?? DEFAULT_MAX_TOKENS,
    temperature: options?.temperature ?? DEFAULT_TEMPERATURE,
    system: options?.systemPrompt,
    messages: [{ role: "user", content: prompt }],
  });
}

/** Exposed so stream/handler.ts can normalize mid-stream errors consistently. */
export function normalizeStreamError(err: unknown): AIError {
  return normalizeError(err);
}

// ---------------------------------------------------------------------------
// Structured output (via forced tool use)
// ---------------------------------------------------------------------------

/**
 * Anthropic has no native "JSON mode". Structured output is implemented by
 * defining a single tool whose input_schema is the caller's desired schema,
 * then forcing the model to call that tool via tool_choice. The tool's
 * input is the structured result.
 */
export async function generateStructuredOutputService<T = unknown>(
  prompt: string,
  options: StructuredOutputOptions
): Promise<AIResult<GenerateStructuredOutputResult<T>>> {
  try {
    const anthropic = getClient();

    const response = await anthropic.messages.create({
      model: options.model ?? DEFAULT_MODEL,
      max_tokens: options.maxTokens ?? DEFAULT_MAX_TOKENS,
      temperature: options.temperature ?? DEFAULT_TEMPERATURE,
      system: options.systemPrompt,
      messages: [{ role: "user", content: prompt }],
      tools: [
        {
          name: options.schemaName,
          description: `Structured output matching the ${options.schemaName} schema.`,
          input_schema: options.schema as Anthropic.Tool["input_schema"],
        },
      ],
      tool_choice: { type: "tool", name: options.schemaName },
    });

    const toolUseBlock = response.content.find(
      (block) => block.type === "tool_use"
    );

    if (!toolUseBlock || toolUseBlock.type !== "tool_use") {
      return {
        error: {
          code: "unknown_error",
          message: "The model did not return structured output as expected.",
        },
      };
    }

    return {
      data: {
        data: toolUseBlock.input as T,
        model: response.model,
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
