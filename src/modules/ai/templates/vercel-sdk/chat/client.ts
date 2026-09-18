/**
 * Client-side functions for the Vercel AI SDK Chat module.
 * Import this into Client Components. Everything else (sendMessage,
 * conversation management, transcribeAudio, synthesizeSpeech) are Server
 * Actions in actions.ts — import and call those directly from Client
 * Components as well; only streaming needs a fetch-based helper here.
 */

import type { AIServiceError, ChatStreamParams } from "./types";

/** Path to the route handler created from stream/route.ts. */
const STREAM_ENDPOINT = "/api/ai-sdk/chat/stream";

const KNOWN_ERROR_CODES = [
  "RATE_LIMITED",
  "INVALID_REQUEST",
  "PROVIDER_ERROR",
  "STORE_NOT_CONFIGURED",
  "NOT_IMPLEMENTED",
  "UNKNOWN",
];

/** Detects whether a piece of text is actually a serialized AIServiceError. */
function tryParseError(text: string): AIServiceError | null {
  try {
    const parsed = JSON.parse(text);
    if (parsed && KNOWN_ERROR_CODES.includes(parsed.code)) {
      return parsed as AIServiceError;
    }
  } catch {
    // Not JSON — it's regular generated text.
  }
  return null;
}

export interface ChatStreamCallbacks {
  /** Called for each chunk of the assistant's reply, in order. */
  onChunk: (chunk: string) => void;
  /** Called once if the request fails, either before or during streaming. */
  onError?: (error: AIServiceError) => void;
  /** Called once the stream completes successfully. */
  onFinish?: () => void;
}

/**
 * Streams a chat reply from stream/route.ts and forwards chunks to
 * `onChunk` as they arrive. The user's message and the assistant's full
 * reply are persisted server-side once generation finishes — no separate
 * save call is needed from the client.
 *
 * Note: if the provider fails mid-stream, the error message is embedded
 * as the final piece of stream text (see stream/handler.ts). This function
 * checks the last chunk for that pattern and routes it to `onError`
 * instead of `onChunk`.
 */
export async function streamChat(
  params: ChatStreamParams,
  { onChunk, onError, onFinish }: ChatStreamCallbacks,
  signal?: AbortSignal
): Promise<void> {
  let response: Response;

  try {
    response = await fetch(STREAM_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
      signal,
    });
  } catch {
    onError?.({
      code: "UNKNOWN",
      message: "Could not reach the server. Check your connection and try again.",
    });
    return;
  }

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    onError?.(
      body?.error ?? {
        code: "UNKNOWN",
        message: "The request failed unexpectedly.",
      }
    );
    return;
  }

  if (!response.body) {
    onError?.({ code: "UNKNOWN", message: "No response body received." });
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let lastChunk = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      lastChunk = chunk;
      onChunk(chunk);
    }
  } catch {
    onError?.({
      code: "UNKNOWN",
      message: "The connection was interrupted while streaming.",
    });
    return;
  }

  const errorFromStream = tryParseError(lastChunk);
  if (errorFromStream) {
    onError?.(errorFromStream);
    return;
  }

  onFinish?.();
}
