/**
 * Internal handler for the streaming text generation endpoint.
 *
 * Not meant to be edited by the consumer. route.ts simply calls
 * handleStreamRequest() and returns its Response.
 *
 * Protocol: the response body is newline-delimited JSON (NDJSON).
 * Each line is one of:
 *   { "type": "chunk", "text": string }
 *   { "type": "error", "error": AIError }
 *   { "type": "done" }
 *
 * client.ts knows how to parse this format — see its streamText() function.
 */

import { streamTextService, normalizeStreamError } from "./service";
import type { StreamRequestBody } from "./types";

export async function handleStreamRequest(request: Request): Promise<Response> {
  let body: StreamRequestBody;

  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({
        type: "error",
        error: { code: "invalid_request", message: "Invalid JSON body." },
      }) + "\n",
      { status: 400 }
    );
  }

  if (!body.prompt || typeof body.prompt !== "string") {
    return new Response(
      JSON.stringify({
        type: "error",
        error: { code: "invalid_request", message: "Missing or invalid 'prompt'." },
      }) + "\n",
      { status: 400 }
    );
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: unknown) => {
        controller.enqueue(encoder.encode(JSON.stringify(payload) + "\n"));
      };

      try {
        const anthropicStream = streamTextService(body.prompt, body.options);

        anthropicStream.on("text", (text) => {
          send({ type: "chunk", text });
        });

        // Waits for the stream to finish (or throw) before closing.
        await anthropicStream.finalMessage();

        send({ type: "done" });
      } catch (err) {
        send({ type: "error", error: normalizeStreamError(err) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache",
    },
  });
}
