/**
 * Route handler for streaming chat messages.
 *
 * Copy this file to: app/api/ai-sdk/chat/stream/route.ts
 * (the path used by client.ts's default STREAM_ENDPOINT).
 */

import { handleChatStreamRequest } from "@/lib/ai/vercel-sdk/chat/handler";
import type { ChatStreamParams } from "@/lib/ai/vercel-sdk/chat/types";

export async function POST(request: Request): Promise<Response> {
  let body: Partial<ChatStreamParams>;

  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: { code: "INVALID_REQUEST", message: "Invalid JSON body." } },
      { status: 400 }
    );
  }

  if (!body.conversationId || typeof body.conversationId !== "string") {
    return Response.json(
      {
        error: {
          code: "INVALID_REQUEST",
          message: "A non-empty 'conversationId' string is required.",
        },
      },
      { status: 400 }
    );
  }

  if (!body.message || typeof body.message !== "string") {
    return Response.json(
      {
        error: {
          code: "INVALID_REQUEST",
          message: "A non-empty 'message' string is required.",
        },
      },
      { status: 400 }
    );
  }

  return handleChatStreamRequest({
    conversationId: body.conversationId,
    message: body.message,
    system: body.system,
    temperature: body.temperature,
    maxTokens: body.maxTokens,
    model: body.model,
  });
}
