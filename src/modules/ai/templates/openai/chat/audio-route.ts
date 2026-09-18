import { createSpeechStream } from "@/lib/ai/openai/chat/audio-handler";
import type { SynthesizeSpeechOptions, AIActionError } from "@/lib/ai/openai/chat/types";

// ============================================================================
// OpenAI Chat — Speech route
// Copy this file to: app/api/openai-chat/speech/route.ts
// (See SETUP.md — client.ts's SPEECH_ENDPOINT must match this path.)
// ============================================================================

export async function POST(request: Request) {
  const options = (await request.json()) as SynthesizeSpeechOptions;

  try {
    const stream = await createSpeechStream(options);

    return new Response(stream, {
      headers: {
        "Content-Type": "audio/mpeg",
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
    case "TIMEOUT":
      return 504;
    default:
      return 500;
  }
}
