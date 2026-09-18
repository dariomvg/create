/**
 * Internal streaming logic for the Vercel AI SDK Text Generation module.
 * Used by stream/route.ts — not meant to be imported by UI code directly.
 */

import { streamTextService, normalizeStreamError } from "./service";
import type { StreamTextParams, AIServiceError } from "./types";

/** Maps a normalized error code to an HTTP status for the Response. */
function statusForError(error: AIServiceError): number {
  switch (error.code) {
    case "RATE_LIMITED":
      return 429;
    case "INVALID_REQUEST":
      return 400;
    case "PROVIDER_ERROR":
      return 502;
    default:
      return 500;
  }
}

/**
 * Builds the streaming Response for a text generation request.
 * - Pre-flight errors (e.g. rate limit) return a JSON error Response.
 * - Mid-stream errors are caught by the AI SDK and surfaced as a
 *   normalized error message inside the stream itself, via getErrorMessage.
 */
export async function handleStreamRequest(
  params: StreamTextParams
): Promise<Response> {
  const result = streamTextService(params);

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
