import { createChatStream } from "@/lib/ai/openai/chat/stream-handler";
import type { ChatCompletionOptions, AIActionError } from "@/lib/ai/openai/chat/types";

// ============================================================================
// OpenAI Chat — Stream route
// Copy this file to: app/api/openai-chat/stream/route.ts
// (See SETUP.md — client.ts's CHAT_STREAM_ENDPOINT must match this path.)
// ============================================================================

export async function POST(request: Request) {
  const options = (await request.json()) as ChatCompletionOptions;

  try {
    const stream = await createChatStream(options);

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
      },
    });
  } catch (err) {
    const error = err as AIActionError;

    return Response.json({ error }, { status: statusForError(error) });
  }
}

function statusForError(error: AIActionError): number {
  switch (error.code) {
    case "RATE_LIMITED":
      return 429;
    case "AUTH_ERROR":
      return 401;
    case "INVALID_REQUEST":
      return 400;
    case "NOT_FOUND":
      return 404;
    case "TIMEOUT":
      return 504;
    default:
      return 500;
  }
}
