import type { GenerateTextOptions, AIActionError } from "./types";

// ============================================================================
// OpenAI Text Generation — Client
// Import these from client components ("use client"). For non-streaming
// generation, use lib/openai/actions.ts from a Server Component instead.
// ============================================================================

/**
 * Must match wherever stream/route.ts is copied to (see SETUP.md).
 */
const STREAM_ENDPOINT = "/api/openai/stream";

/**
 * Streams a text completion from the client, yielding chunks of text as
 * they arrive. Errors (including rate limiting) are thrown as an
 * AIActionError — wrap calls in try/catch to show them in the UI.
 *
 * Usage:
 *   try {
 *     for await (const chunk of streamText({ prompt })) {
 *       setText((prev) => prev + chunk);
 *     }
 *   } catch (error) {
 *     const aiError = error as AIActionError;
 *     // aiError.code, aiError.message, aiError.retryable, aiError.retryAfter
 *   }
 */
export async function* streamText(
  options: GenerateTextOptions
): AsyncGenerator<string, void, unknown> {
  const response = await fetch(STREAM_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(options),
  });

  if (!response.ok || !response.body) {
    throw await parseErrorResponse(response);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      if (chunk) yield chunk;
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Reads the JSON error body sent by stream/route.ts and returns it as a
 * normalized AIActionError. Falls back to a generic UNKNOWN error if the
 * response body isn't in the expected shape (e.g. a network-level failure).
 */
async function parseErrorResponse(response: Response): Promise<AIActionError> {
  try {
    const body = await response.json();
    if (body?.error?.code) {
      return body.error as AIActionError;
    }
  } catch {
    // response body wasn't JSON — fall through to the generic error below.
  }

  return {
    code: "UNKNOWN",
    message: "Something went wrong while streaming the response.",
    retryable: false,
  };
}
