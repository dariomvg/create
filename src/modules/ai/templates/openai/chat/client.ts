import type { ChatCompletionOptions, SynthesizeSpeechOptions, AIActionError } from "./types";

// ============================================================================
// OpenAI Chat — Client
// Import these from client components ("use client"). For non-streaming
// chat and conversation management, use lib/openai-chat/actions.ts from a
// Server Component instead.
// ============================================================================

/** Must match wherever stream/route.ts is copied to (see SETUP.md). */
const CHAT_STREAM_ENDPOINT = "/api/openai-chat/stream";

/** Must match wherever audio/route.ts is copied to (see SETUP.md). */
const SPEECH_ENDPOINT = "/api/openai-chat/speech";

/**
 * Streams an assistant reply for an existing conversation, yielding text
 * chunks as they arrive. The full exchange is persisted server-side once
 * the stream completes.
 *
 * Usage:
 *   try {
 *     for await (const chunk of streamChatMessage({ conversationId, message })) {
 *       setReply((prev) => prev + chunk);
 *     }
 *   } catch (error) {
 *     const aiError = error as AIActionError;
 *   }
 */
export async function* streamChatMessage(
  options: ChatCompletionOptions
): AsyncGenerator<string, void, unknown> {
  const response = await fetch(CHAT_STREAM_ENDPOINT, {
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
 * Converts text to speech and returns a playable audio Blob.
 *
 * Usage:
 *   const blob = await textToSpeech({ text: "Hello there" });
 *   const audio = new Audio(URL.createObjectURL(blob));
 *   audio.play();
 */
export async function textToSpeech(options: SynthesizeSpeechOptions): Promise<Blob> {
  const response = await fetch(SPEECH_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(options),
  });

  if (!response.ok) {
    throw await parseErrorResponse(response);
  }

  return response.blob();
}

/**
 * Reads the JSON error body sent by the route handlers and returns it as a
 * normalized AIActionError. Falls back to a generic UNKNOWN error if the
 * response body isn't in the expected shape.
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
    message: "Something went wrong while contacting the server.",
    retryable: false,
  };
}
