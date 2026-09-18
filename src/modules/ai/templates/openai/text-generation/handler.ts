import { streamText } from "./service";
import { toAIError } from "./service";
import type { GenerateTextOptions, AIActionError } from "./types";

// ============================================================================
// OpenAI Text Generation — Stream handler (internal)
// Called by stream/route.ts. Not meant to be imported anywhere else.
// ============================================================================

/**
 * Runs the OpenAI streaming completion and returns a plain-text
 * ReadableStream ready to be used as a Response body.
 * Throws a normalized AIActionError if the stream can't be started
 * (e.g. rate limited, invalid request, missing API key).
 */
export async function createTextStream(
  options: GenerateTextOptions
): Promise<ReadableStream<Uint8Array>> {
  let openaiStream: Awaited<ReturnType<typeof streamText>>;

  try {
    openaiStream = await streamText(options);
  } catch (err) {
    // Re-throw already normalized (streamText/service.ts uses toAIError internally).
    throw err as AIActionError;
  }

  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const part of openaiStream) {
          const delta = part.choices[0]?.delta?.content ?? "";
          if (delta) controller.enqueue(encoder.encode(delta));
        }
        controller.close();
      } catch (err) {
        // Error mid-stream: nothing left to do but close the connection.
        // The client will see a truncated response; nothing more can be sent
        // once headers/body have started streaming.
        controller.error(toAIError(err));
      }
    },
  });
}
