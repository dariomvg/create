# OpenAI Text Generation — Setup

Drop-in text generation module for Next.js (App Router) using the OpenAI SDK.
Covers text generation, streaming, system/user prompts, temperature config,
and structured output (JSON schema).

## Dependencies

- `openai` — official OpenAI SDK

## Environment variables

See `.env.local`:

- `OPENAI_API_KEY` — required.

## File structure

```
lib/openai/
├── service.ts        # Internal logic (SDK calls, error normalization). Do not import directly.
├── actions.ts         # "use server" — public API for Server Components (generateText, generateStructuredOutput)
├── client.ts            # Public API for Client Components (streamText)
├── types.ts               # Types, default model/token config, rate limit config
├── stream/
│   ├── handler.ts        # Internal — builds the ReadableStream. Do not import directly.
│   └── route.ts            # Copy to app/api/openai/stream/route.ts
└── .env.local
```

## Setup steps

1. Copy the `lib/openai/` folder into your project.
2. Copy `lib/openai/stream/route.ts` to `app/api/openai/stream/route.ts`.
3. Set `OPENAI_API_KEY` in your project's `.env.local`.

## Usage

### From a Server Component / server action (non-streaming)

```ts
import { generateTextAction } from "@/lib/openai/actions";

const result = await generateTextAction({
  prompt: "Write a haiku about the ocean",
  systemPrompt: "You are a concise poet.",
  temperature: 0.8,
});

if (result.ok) {
  console.log(result.data.text);
} else {
  // result.error: { code, message, retryable, retryAfter? }
  console.error(result.error.message);
}
```

### Structured output

```ts
import { generateStructuredOutputAction } from "@/lib/openai/actions";

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
  console.log(result.data.data.title);
}
```

### From a Client Component (streaming)

```tsx
"use client";

import { useState } from "react";
import { streamText } from "@/lib/openai/client";
import type { AIActionError } from "@/lib/openai/types";

export function Chat() {
  const [text, setText] = useState("");
  const [error, setError] = useState<AIActionError | null>(null);

  async function handleGenerate() {
    setText("");
    setError(null);

    try {
      for await (const chunk of streamText({ prompt: "Tell me a story" })) {
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
            ? `Too many requests — try again in ${error.retryAfter}s`
            : error.message}
        </p>
      )}
      <p>{text}</p>
    </div>
  );
}
```

## Error handling

Every function returns/throws the same normalized shape instead of raw
OpenAI SDK errors:

```ts
interface AIActionError {
  code: "RATE_LIMITED" | "INVALID_REQUEST" | "AUTH_ERROR" | "TIMEOUT" | "UNKNOWN";
  message: string;
  retryable: boolean;
  retryAfter?: number; // seconds, only set for RATE_LIMITED
}
```

- `actions.ts` functions never throw — they return `{ ok: false, error }`.
- `client.ts`'s `streamText` throws the `AIActionError` — use try/catch.

## Rate limiting

Handled as part of the same error system, not separately:

- `generateText` / `generateStructuredOutput` automatically retry on a 429
  with exponential backoff (see `RATE_LIMIT_CONFIG` in `types.ts`), up to
  `maxRetries`. If retries are exhausted, the error surfaces as
  `RATE_LIMITED` with a `retryAfter` (seconds) taken from OpenAI's
  `retry-after` header when present.
- `streamText` does not auto-retry (a stream can't be safely resumed
  mid-way) — a 429 before the stream starts surfaces immediately as
  `RATE_LIMITED`.

## Known limitation

If a streaming request fails **after** the response has started (rare —
usually only a mid-stream network/API failure), the connection is simply
closed. No JSON error can be sent at that point since the HTTP response
already started as `text/plain`. Handle this in the UI by treating an
unexpectedly short/incomplete stream as a soft failure.
