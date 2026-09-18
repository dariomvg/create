import { synthesizeSpeech } from "../service";
import type { SynthesizeSpeechOptions, AIActionError } from "../types";

// ============================================================================
// OpenAI Chat — Speech handler (internal)
// Called by audio/route.ts. Not meant to be imported anywhere else.
// ============================================================================

/**
 * Runs OpenAI's text-to-speech and returns a ReadableStream of audio bytes
 * (mp3) ready to be used as a Response body.
 * Throws a normalized AIActionError if the request fails.
 */
export async function createSpeechStream(
  options: SynthesizeSpeechOptions
): Promise<ReadableStream<Uint8Array>> {
  const openaiResponse = await synthesizeSpeech(options).catch((err) => {
    throw err as AIActionError;
  });

  // The OpenAI SDK returns a fetch-compatible Response — its body is
  // already a ReadableStream in most runtimes.
  if (openaiResponse.body) {
    return openaiResponse.body;
  }

  // Fallback for runtimes that don't expose a native stream body: buffer
  // the whole file and emit it as a single chunk.
  const buffer = await openaiResponse.arrayBuffer();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(buffer));
      controller.close();
    },
  });
}
