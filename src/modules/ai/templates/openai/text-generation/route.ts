import { createTextStream } from "@/lib/ai/openai/text-generation/handler";
import type { GenerateTextOptions, AIActionError } from "@/lib/ai/openai/text-generation/types";

// ============================================================================
// OpenAI Text Generation — Stream route
// Copy this file to: app/api/openai/stream/route.ts
// (See SETUP.md — client.ts's STREAM_ENDPOINT must match this path.)
// ============================================================================

export async function POST(request: Request) {
  const options = (await request.json()) as GenerateTextOptions;

  try {
    const stream = await createTextStream(options);

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
      },
    });
  } catch (err) {
    const error = err as AIActionError;

    return Response.json(
      { error },
      { status: statusForError(error) }
    );
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
    case "TIMEOUT":
      return 504;
    default:
      return 500;
  }
}
