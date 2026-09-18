/**
 * Internal handler for the streaming chat endpoint.
 *
 * Not meant to be edited by the consumer. route.ts simply calls
 * handleStreamRequest() and returns its Response.
 *
 * Protocol: same NDJSON format as the Text Generation module.
 *   { "type": "chunk", "text": string }
 *   { "type": "error", "error": AIError }
 *   { "type": "done" }
 */

import { streamChatService, persistAssistantMessage, normalizeStreamError } from "./service";
import type { StreamChatRequestBody } from "./types";

export async function handleStreamRequest(request: Request): Promise<Response> {
  let body: StreamChatRequestBody;

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

  if (!body.conversationId || !body.content) {
    return new Response(
      JSON.stringify({
        type: "error",
        error: {
          code: "invalid_request",
          message: "Missing 'conversationId' or 'content'.",
        },
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
        const prepared = await streamChatService(
          body.conversationId,
          body.content,
          body.options
        );

        if (prepared.error) {
          send({ type: "error", error: prepared.error });
          return;
        }

        let fullText = "";

        prepared.data.stream.on("text", (text) => {
          fullText += text;
          send({ type: "chunk", text });
        });

        await prepared.data.stream.finalMessage();
        await persistAssistantMessage(body.conversationId, fullText);

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
