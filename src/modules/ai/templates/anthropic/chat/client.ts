/**
 * Client-side functions for the Anthropic Chat module.
 *
 * Import these into client components ("use client"). For non-streaming
 * operations from server components, use actions.ts instead.
 */

import type { AIError, GenerationOptions, StreamChatRequestBody } from "./types";

export interface StreamMessageCallbacks {
  /** Called for every incremental piece of the assistant's reply. */
  onChunk: (text: string) => void;
  /** Called once if the stream fails, with a normalized error safe to render. */
  onError?: (error: AIError) => void;
  /** Called once the stream completes successfully. */
  onDone?: () => void;
}

/**
 * Sends a message in an existing conversation and streams the assistant's
 * reply from /api/anthropic/chat/stream. The full response is persisted
 * server-side once the stream completes.
 *
 * Make sure stream/route.ts has been copied to
 * app/api/anthropic/chat/stream/route.ts in your project before using this.
 *
 * @example
 * streamMessage(conversationId, "What's the weather like on Mars?", undefined, {
 *   onChunk: (text) => setReply((prev) => prev + text),
 *   onError: (error) => setErrorMessage(error.message),
 *   onDone: () => setIsStreaming(false),
 * });
 *
 * @returns an AbortController you can use to cancel the stream early.
 */
export function streamMessage(
  conversationId: string,
  content: string,
  options: GenerationOptions | undefined,
  callbacks: StreamMessageCallbacks
): AbortController {
  const controller = new AbortController();

  (async () => {
    try {
      const body: StreamChatRequestBody = { conversationId, content, options };

      const response = await fetch("/api/anthropic/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.body) {
        callbacks.onError?.({
          code: "unknown_error",
          message: "No response body received from the server.",
        });
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;

          const event = JSON.parse(line) as
            | { type: "chunk"; text: string }
            | { type: "error"; error: AIError }
            | { type: "done" };

          if (event.type === "chunk") {
            callbacks.onChunk(event.text);
          } else if (event.type === "error") {
            callbacks.onError?.(event.error);
          } else if (event.type === "done") {
            callbacks.onDone?.();
          }
        }
      }
    } catch (err) {
      if (controller.signal.aborted) return;

      callbacks.onError?.({
        code: "network_error",
        message: err instanceof Error ? err.message : "Streaming request failed.",
      });
    }
  })();

  return controller;
}
