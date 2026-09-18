/**
 * Internal streaming logic for the Vercel AI SDK Chat module.
 * Used by stream/route.ts — not meant to be imported by UI code directly.
 */

import { streamChatCompletionService, normalizeStreamError } from "./service";
import { requireConversationStore } from "./store";
import type { ChatStreamParams, Message, AIServiceError } from "./types";

/** Maps a normalized error code to an HTTP status for the Response. */
function statusForError(error: AIServiceError): number {
  switch (error.code) {
    case "RATE_LIMITED":
      return 429;
    case "INVALID_REQUEST":
      return 400;
    case "PROVIDER_ERROR":
      return 502;
    case "STORE_NOT_CONFIGURED":
      return 500;
    default:
      return 500;
  }
}

/**
 * Builds the streaming Response for a chat message.
 * - Pre-flight errors (missing store, rate limit) return a JSON error Response.
 * - On success, both the user's message and the assistant's full reply are
 *   persisted server-side once generation finishes, independent of whether
 *   the client keeps reading the stream.
 * - Mid-stream errors are surfaced inside the stream itself via
 *   getErrorMessage (see stream/route.ts's caller / client.ts for parsing).
 */
export async function handleChatStreamRequest(
  params: ChatStreamParams
): Promise<Response> {
  const storeResult = requireConversationStore();
  if (!storeResult.success) {
    return Response.json(
      { error: storeResult.error },
      { status: statusForError(storeResult.error) }
    );
  }
  const store = storeResult.data;

  const history = await store.getMessages(params.conversationId);

  const userMessage: Message = {
    id: crypto.randomUUID(),
    conversationId: params.conversationId,
    role: "user",
    content: params.message,
    createdAt: new Date().toISOString(),
  };

  const result = streamChatCompletionService(
    {
      history,
      newMessage: params.message,
      system: params.system,
      temperature: params.temperature,
      maxTokens: params.maxTokens,
      model: params.model,
    },
    async ({ text }) => {
      await store.addMessage(userMessage);
      await store.addMessage({
        id: crypto.randomUUID(),
        conversationId: params.conversationId,
        role: "assistant",
        content: text,
        createdAt: new Date().toISOString(),
      });
    }
  );

  if (!result.success) {
    return Response.json(
      { error: result.error },
      { status: statusForError(result.error) }
    );
  }

  return result.data.toTextStreamResponse({
    headers: { "Cache-Control": "no-cache" },
    getErrorMessage: (error) => JSON.stringify(normalizeStreamError(error)),
  });
}
