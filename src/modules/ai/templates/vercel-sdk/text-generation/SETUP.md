# Vercel AI SDK — Text Generation Module

A self-contained module for text generation using the [Vercel AI SDK](https://sdk.vercel.ai) with **Google (Gemini)** as the provider. Covers generate text, streaming text, system prompts, temperature/config, and structured output.

## Dependencies

This module uses:

- `ai` — the Vercel AI SDK core (`generateText`, `streamText`, `generateObject`, `APICallError`)
- `@ai-sdk/google` — the Google (Gemini) provider adapter
- `zod` — used to define schemas for structured output (peer dependency of `generateObject`)

## File structure

```
types.ts            Shared types, default model config, rate limit config
service.ts           Internal logic: calls the AI SDK, normalizes errors — do not modify
actions.ts            Server Actions — import into Server Components
client.ts              Client-side streaming helper — import into Client Components
stream/handler.ts   Internal streaming logic used by the route handler
stream/route.ts       Route handler — copy to app/api/ai-sdk/stream/route.ts
.env.local             Environment variable for the Google API key
```

## Setup

1. Copy `stream/route.ts` into your project at:
   ```
   app/api/ai-sdk/stream/route.ts
   ```
   (its import of `../service` and `../types` will then resolve to this module's `service.ts` / `types.ts` — keep `stream/handler.ts` alongside it, or adjust the relative imports if you place files differently)

2. Add your Google AI API key to `.env.local`. Get one at https://aistudio.google.com/apikey

3. Import from `actions.ts` (server) or `client.ts` (client) as shown below.

## Usage

### Generate text (server)

```ts
import { generateText } from "@/lib/ai/actions";

const result = await generateText({
  prompt: "Write a haiku about the ocean",
  system: "You are a concise, poetic assistant.",
  temperature: 0.8,
});

if (result.success) {
  console.log(result.data.text);
} else {
  // result.error: { code, message, retryAfter? }
  console.error(result.error.message);
}
```

### Structured output (server)

```ts
import { generateStructuredOutput } from "@/lib/ai/actions";
import { z } from "zod";

const schema = z.object({
  title: z.string(),
  tags: z.array(z.string()),
});

const result = await generateStructuredOutput({
  prompt: "Summarize this article into a title and tags: ...",
  schema,
});

if (result.success) {
  console.log(result.data.object.title, result.data.object.tags);
}
```

### Stream text (client)

```tsx
"use client";

import { useState } from "react";
import { streamText } from "@/lib/ai/client";

export function ChatDemo() {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setText("");
    setError(null);

    await streamText(
      { prompt: "Explain quantum computing simply" },
      {
        onChunk: (chunk) => setText((prev) => prev + chunk),
        onError: (err) => setError(err.message),
        onFinish: () => console.log("done"),
      }
    );
  }

  return (
    <div>
      <button onClick={handleSubmit}>Generate</button>
      {error ? <p role="alert">{error}</p> : <p>{text}</p>}
    </div>
  );
}
```

## Error handling

Every function returns (or surfaces, in the streaming case) a normalized error shape instead of a raw SDK/provider error:

```ts
{
  code: "RATE_LIMITED" | "INVALID_REQUEST" | "PROVIDER_ERROR" | "UNKNOWN",
  message: string,       // safe to show in the UI
  retryAfter?: number,   // seconds, only present for RATE_LIMITED
}
```

Use `code` to branch UI behavior (e.g. disable the submit button and show a countdown when `retryAfter` is present) and `message` as the user-facing text.

## Rate limiting

Two layers, both surfaced as `RATE_LIMITED` errors:

- **Local guard** (`types.ts` → `RATE_LIMIT_CONFIG`): a simple in-memory sliding-window limiter (default: 20 requests / minute per server instance) that stops requests before they reach the provider. Per-instance only — not shared across multiple server instances.
- **Provider rate limit**: if Google's API itself returns a 429, it's caught and normalized the same way, including `retryAfter` when the provider supplies a `retry-after` header.

## Known limitation

Mid-stream provider errors are embedded as the final piece of streamed text (the AI SDK's text-stream protocol doesn't support out-of-band error signaling). `client.ts` detects this with a best-effort check on the last received chunk. This is a simplification — if this ever becomes a problem, switching to the AI SDK's data-stream protocol would allow structured error parts, at the cost of extra client-side parsing complexity.
