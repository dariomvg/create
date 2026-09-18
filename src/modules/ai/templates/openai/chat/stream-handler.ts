import { streamChatCompletion, persistAssistantReply, toAIError } from "./service";
import type { ChatCompletionOptions, AIActionError } from "./types";

// ============================================================================
// OpenAI Chat — Stream handler (internal)
// Called by stream/route.ts. Not meant to be imported anywhere else.
// ============================================================================

/**
 * Runs the OpenAI streaming chat completion and returns a plain-text
 * ReadableStream. Once the stream finishes, the full assistant reply is
 * persisted to the conversation history.
 * Throws a normalized AIActionError if the stream can't be started
 * (e.g. conversation not found, rate limited, missing API key).
 */
export async function createChatStream(
  options: ChatCompletionOptions
): Promise<ReadableStream<Uint8Array>> {
  let openaiStream: Awaited<ReturnType<typeof streamChatCompletion>>;

  try {
    openaiStream = await streamChatCompletion(options);
  } catch (err) {
    throw err as AIActionError;
  }

  const encoder = new TextEncoder();
  let fullReply = "";

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const part of openaiStream) {
          const delta = part.choices[0]?.delta?.content ?? "";
          if (delta) {
            fullReply += delta;
            controller.enqueue(encoder.encode(delta));
          }
        }

        // Persist the complete reply now that the stream is done.
        await persistAssistantReply(options.conversationId, fullReply);

        controller.close();
      } catch (err) {
        // Error mid-stream: nothing left to send but a closed connection.
        // The partial reply is intentionally NOT persisted, since it's
        // incomplete and could confuse follow-up turns.
        controller.error(toAIError(err));
      }
    },
  });
}
