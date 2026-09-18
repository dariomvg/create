/**
 * Streaming API route for text generation.
 *
 * Copy this file to: app/api/anthropic/stream/route.ts
 *
 * Server Actions cannot return a native ReadableStream, so streaming
 * requires a real route handler. client.ts's streamText() function
 * calls this endpoint via fetch().
 */

import { handleStreamRequest } from "@/lib/ai/anthropic/text-generation/handler";

export async function POST(request: Request): Promise<Response> {
  return handleStreamRequest(request);
}
