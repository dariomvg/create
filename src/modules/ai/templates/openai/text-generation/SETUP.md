# OpenAI Text Generation

Text generation with the OpenAI SDK for Next.js (App Router): single-shot generation, streaming, system and user prompts, temperature and token configuration, and structured output validated against a JSON Schema.

## Dependencies

- `openai`
- `server-only`

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `OPENAI_API_KEY` | Yes | OpenAI API key. Read on the server only. |

## File structure

```
lib/ai/openai/text-generation/
├── actions.ts        # "use server" — public API for server code
├── client.ts         # Public API for Client Components (streaming)
├── service.ts        # Internal — SDK calls, rate limit retry, error normalization. Never import directly.
├── types.ts          # Types, defaults (model, tokens, temperature) and rate limit config
└── stream/
    └── handler.ts    # Internal — builds the text ReadableStream. Used only by the route handler.

app/api/openai/stream/route.ts   # POST route handler (streaming)
```

`client.ts` calls `/api/openai/stream` (the `STREAM_ENDPOINT` constant). Keep it in sync with the route's location.

## Public API

### `actions.ts` — `@/lib/ai/openai/text-generation/actions`

Server-side. Never throw: always check `result.ok`.

| Export | Arguments | Returns |
|---|---|---|
| `generateTextAction` | `options: GenerateTextOptions` | `Promise<AIActionResult<GenerateTextResult>>` |
| `generateStructuredOutputAction<T>` | `options: GenerateStructuredOutputOptions` | `Promise<AIActionResult<GenerateStructuredOutputResult<T>>>` |

### `client.ts` — `@/lib/ai/openai/text-generation/client`

Browser-side. Throws an `AIActionError` on failure (use `try/catch`).

| Export | Arguments | Returns |
|---|---|---|
| `streamText` | `options: GenerateTextOptions` | `AsyncGenerator<string>` — yields text chunks as they arrive |

### Route handler — `app/api/openai/stream/route.ts`

| Export | Arguments | Returns |
|---|---|---|
| `POST` | JSON body: `GenerateTextOptions` | `200` with a `text/plain` stream of text chunks. On failure, JSON `{ error: AIActionError }` with status `429` (`RATE_LIMITED`), `401` (`AUTH_ERROR`), `400` (`INVALID_REQUEST`), `504` (`TIMEOUT`) or `500` (anything else). |

### Types — `@/lib/ai/openai/text-generation/types`

```ts
interface GenerateTextOptions {
  prompt: string;            // user prompt
  systemPrompt?: string;
  model?: string;            // default "gpt-4o-mini"
  temperature?: number;      // default 0.7
  maxOutputTokens?: number;  // default 1024, capped at 4096
}

interface GenerateTextResult {
  text: string;
  model: string;
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
}

interface GenerateStructuredOutputOptions extends GenerateTextOptions {
  schema: Record<string, unknown>; // JSON Schema describing the output
  schemaName: string;              // identifier required by the OpenAI API
}

interface GenerateStructuredOutputResult<T> {
  data: T;
  model: string;
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
}

type AIActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: AIActionError };

interface AIActionError {
  code: "RATE_LIMITED" | "INVALID_REQUEST" | "AUTH_ERROR" | "TIMEOUT" | "UNKNOWN";
  message: string;      // safe to show in the UI
  retryable: boolean;
  retryAfter?: number;  // seconds — only set for RATE_LIMITED
}
```

### Behavior

- **Rate limit:** `generateTextAction` and `generateStructuredOutputAction` retry a 429 up to 2 times with exponential backoff. If retries run out, the result is `RATE_LIMITED` with `retryAfter` in seconds (from OpenAI's `retry-after` header, 20 by default). `streamText` and the route do not retry: a 429 before the stream starts is thrown immediately as `RATE_LIMITED`.
- **Structured output** uses OpenAI strict JSON Schema mode: every object level needs `additionalProperties: false` and all of its properties listed in `required`. A schema that breaks this, or a model reply that is not valid JSON, returns `INVALID_REQUEST`.
- **Failure after the stream has started:** the connection is closed and no JSON error can be sent. Treat a truncated stream as a failed request in the UI.

## Examples

### Generate text (server)

```ts
import { generateTextAction } from "@/lib/ai/openai/text-generation/actions";

const result = await generateTextAction({
  prompt: "Write a haiku about the ocean",
  systemPrompt: "You are a concise poet.",
  temperature: 0.8,
});

if (result.ok) {
  console.log(result.data.text);
} else {
  console.error(result.error.code, result.error.message);
}
```

### Structured output (server)

```ts
import { generateStructuredOutputAction } from "@/lib/ai/openai/text-generation/actions";

const result = await generateStructuredOutputAction<{ title: string; tags: string[] }>({
  prompt: "Summarize this article: ...",
  schemaName: "article_summary",
  schema: {
    type: "object",
    properties: {
      title: { type: "string" },
      tags: { type: "array", items: { type: "string" } },
    },
    required: ["title", "tags"],
    additionalProperties: false,
  },
});

if (result.ok) {
  console.log(result.data.data.title); // result.data.data is the parsed object
}
```

### Streaming with error handling (client)

```tsx
"use client";

import { useState } from "react";
import { streamText } from "@/lib/ai/openai/text-generation/client";
import type { AIActionError } from "@/lib/ai/openai/text-generation/types";

export function StreamedText() {
  const [text, setText] = useState("");
  const [error, setError] = useState<AIActionError | null>(null);

  async function handleGenerate() {
    setText("");
    setError(null);

    try {
      for await (const chunk of streamText({ prompt: "Tell me a short story" })) {
        setText((prev) => prev + chunk);
      }
    } catch (err) {
      setError(err as AIActionError);
    }
  }

  return (
    <div>
      <button onClick={handleGenerate}>Generate</button>
      {error && (
        <p>
          {error.code === "RATE_LIMITED"
            ? `Too many requests. Try again in ${error.retryAfter}s.`
            : error.message}
        </p>
      )}
      <p>{text}</p>
    </div>
  );
}
```