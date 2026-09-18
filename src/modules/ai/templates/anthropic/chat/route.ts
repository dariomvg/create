/**
 * Streaming API route for chat.
 *
 * Copy this file to: app/api/anthropic/chat/stream/route.ts
 *
 * Server Actions cannot return a native ReadableStream, so streaming
 * requires a real route handler. client.ts's streamMessage() function
 * calls this endpoint via fetch().
 */

import { handleStreamRequest } from "@/lib/ai/anthropic/chat/handler";

export async function POST(request: Request): Promise<Response> {
  return handleStreamRequest(request);
}
