# Vercel AI SDK (Gemini) — Text Generation

Text generation with the [Vercel AI SDK](https://sdk.vercel.ai) using Google Gemini as the provider. Supports generating text, streaming text, system prompts, user prompts, temperature/config overrides, and structured output validated against a Zod schema.

Every function returns a normalized `AIResult<T>` (never throws), so results can be branched on `success` and errors rendered directly in the UI.

## Dependencies

| Package | Used for |
|---|---|
| `ai` | `generateText`, `streamText`, `generateObject`, `APICallError` |
| `@ai-sdk/google` | Gemini provider (`google(modelId)`) |
| `zod` | Schema for structured output |

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `GOOGLE_GENERATIVE_AI_API_KEY` | Yes | Google AI (Gemini) API key. Read automatically by `@ai-sdk/google`. |

## File structure

```
lib/ai/vercel-sdk/text-generation/
├── types.ts            # Types, default model/temperature/max tokens, rate limit config
├── service.ts          # Internal logic (AI SDK calls, rate limit, error normalization)
├── actions.ts          # Server Actions — public API for server code
├── client.ts           # Client-side streaming helper — public API for Client Components
└── stream/
    └── handler.ts      # Internal streaming logic used by the route handler

app/api/ai-sdk/stream/
└── route.ts            # POST route handler for streaming
```

`client.ts` calls the route above through its private `STREAM_ENDPOINT` constant (`"/api/ai-sdk/stream"`). If the route is mounted at a different path, update that constant.

## Public API

Import server functions from `@/lib/ai/vercel-sdk/text-generation/actions` and the client function from `@/lib/ai/vercel-sdk/text-generation/client`. Server Actions can also be called directly from Client Components.

| File | Export | Arguments | Returns |
|---|---|---|---|
| `actions.ts` | `generateText` | `params: GenerateTextParams` | `Promise<AIResult<GenerateTextResult>>` |
| `actions.ts` | `generateStructuredOutput<T>` | `params: GenerateStructuredParams<T>` | `Promise<AIResult<GenerateStructuredResult<T>>>` |
| `client.ts` | `streamText` | `params: StreamTextParams`, `callbacks: StreamTextCallbacks`, `signal?: AbortSignal` | `Promise<void>` — chunks and errors are delivered through `callbacks` |
| `app/api/ai-sdk/stream/route.ts` | `POST` | JSON body: `StreamTextParams` (`prompt` is required) | Success: streamed `text/plain` response. Failure: JSON `{ error: AIServiceError }` with status `400` (invalid request), `429` (rate limited), `502` (provider error) or `500` |

### Types

Imported from `@/lib/ai/vercel-sdk/text-generation/types`.

**`GenerateTextParams`** / **`StreamTextParams`**

| Field | Type | Default |
|---|---|---|
| `prompt` | `string` | required |
| `system` | `string?` | — |
| `temperature` | `number?` | `0.7` |
| `maxTokens` | `number?` | `1024` |
| `model` | `string?` | `"gemini-1.5-pro"` |

**`GenerateStructuredParams<T>`** — same fields as above, plus `schema: ZodType<T>` (required).

**`GenerateTextResult`** — `{ text: string; finishReason: string; usage: { promptTokens: number; completionTokens: number; totalTokens: number } }`

**`GenerateStructuredResult<T>`** — `{ object: T; finishReason: string; usage: { ... same as above } }`

**`StreamTextCallbacks`** (exported from `client.ts`)

| Callback | Signature | When |
|---|---|---|
| `onChunk` | `(chunk: string) => void` | For every received chunk, in order (required) |
| `onError` | `(error: AIServiceError) => void` | Once, if the request fails before or during streaming |
| `onFinish` | `() => void` | Once, when the stream completes successfully |

**`AIResult<T>`** — `{ success: true; data: T } | { success: false; error: AIServiceError }`

**`AIServiceError`** — `{ code: "RATE_LIMITED" | "INVALID_REQUEST" | "PROVIDER_ERROR" | "UNKNOWN"; message: string; retryAfter?: number }`. `message` is safe to show in the UI; `retryAfter` (seconds) is only set for `RATE_LIMITED`.

### Behavior notes

- **Rate limiting:** a local in-memory sliding-window limiter (`RATE_LIMIT_CONFIG` in `types.ts`, default 20 requests/minute per server instance) runs before each provider call. A provider-side `429` is normalized to the same `RATE_LIMITED` code, with `retryAfter` when the provider sends a `retry-after` header.
- **Mid-stream errors:** if the provider fails after streaming has started, the error is embedded as the final piece of streamed text. `streamText` in `client.ts` detects it in the last chunk and delivers it to `onError` instead of `onChunk`.
- **Structured output** requires a Zod schema; the validated object is returned in `data.object`.

## Examples

### Generate text (server)

```ts
import { generateText } from "@/lib/ai/vercel-sdk/text-generation/actions";

const result = await generateText({
  prompt: "Write a haiku about the ocean",
  system: "You are a concise, poetic assistant.",
  temperature: 0.8,
});

if (result.success) {
  console.log(result.data.text);
} else {
  console.error(result.error.code, result.error.message);
}
```

### Structured output (server)

```ts
import { z } from "zod";
import { generateStructuredOutput } from "@/lib/ai/vercel-sdk/text-generation/actions";

const result = await generateStructuredOutput({
  prompt: "Summarize this article into a title and tags: ...",
  schema: z.object({
    title: z.string(),
    tags: z.array(z.string()),
  }),
});

if (result.success) {
  console.log(result.data.object.title, result.data.object.tags);
}
```

### Stream text (Client Component)

```tsx
"use client";

import { useState } from "react";
import { streamText } from "@/lib/ai/vercel-sdk/text-generation/client";

export function StreamDemo() {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setText("");
    setError(null);

    await streamText(
      { prompt: "Explain quantum computing simply" },
      {
        onChunk: (chunk) => setText((prev) => prev + chunk),
        onError: (err) => setError(err.message),
      }
    );
  }

  return (
    <div>
      <button onClick={handleGenerate}>Generate</button>
      {error ? <p role="alert">{error}</p> : <p>{text}</p>}
    </div>
  );
}
```

### Handle rate limits in the UI

```ts
const result = await generateText({ prompt: "..." });

if (!result.success && result.error.code === "RATE_LIMITED") {
  // Disable the submit button and show a countdown.
  const seconds = result.error.retryAfter ?? 60;
}
```