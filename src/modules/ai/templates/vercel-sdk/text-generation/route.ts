/**
 * Route handler for streaming text generation.
 *
 * Copy this file to: app/api/ai-sdk/stream/route.ts
 * (the path used by client.ts's default STREAM_ENDPOINT).
 */

import { handleStreamRequest } from "@/lib/ai/vercel-sdk/text-generation/handler";
import type { StreamTextParams } from "@/lib/ai/vercel-sdk/text-generation/types";

export async function POST(request: Request): Promise<Response> {
  let body: Partial<StreamTextParams>;

  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: { code: "INVALID_REQUEST", message: "Invalid JSON body." } },
      { status: 400 }
    );
  }

  if (!body.prompt || typeof body.prompt !== "string") {
    return Response.json(
      {
        error: {
          code: "INVALID_REQUEST",
          message: "A non-empty 'prompt' string is required.",
        },
      },
      { status: 400 }
    );
  }

  return handleStreamRequest({
    prompt: body.prompt,
    system: body.system,
    temperature: body.temperature,
    maxTokens: body.maxTokens,
    model: body.model,
  });
}
