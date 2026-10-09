# Anthropic Text Generation

Text generation with Claude through the official Anthropic SDK: single-shot text, streaming text, system prompts, generation config (model, temperature, max tokens) and structured JSON output. Every function returns (or delivers through a callback) a normalized `AIError` instead of throwing raw SDK errors, including rate limits, so the UI can render it directly.

## Dependencies

- `@anthropic-ai/sdk`

## Environment variables

| Variable | Required | Scope | Description |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | Server only | Anthropic API key. Read lazily by `service.ts`; if missing, the first call fails. |

## File structure

```
@/lib/ai/anthropic/text-generation/
├── types.ts            # Shared types, defaults, error shapes (safe for server and client)
├── service.ts          # Internal Anthropic SDK logic. Never import it directly
├── actions.ts          # "use server" — public API for server components / server actions
├── client.ts           # Public API for client components (streaming)
└── stream/
    └── handler.ts      # Internal streaming request handler used by the route

app/api/anthropic/stream/route.ts   # POST endpoint; delegates to stream/handler.ts
.env.local                          # ANTHROPIC_API_KEY
```

Import base path used below: `@/lib/ai/anthropic/text-generation`.

## Public API

### `actions.ts` (server)

| Export | Arguments | Returns |
|---|---|---|
| `generateText` | `prompt: string`, `options?: GenerationOptions` | `Promise<AIResult<GenerateTextResult>>` |
| `generateStructuredOutput<T>` | `prompt: string`, `options: StructuredOutputOptions` | `Promise<AIResult<GenerateStructuredOutputResult<T>>>` |

### `client.ts` (client)

| Export | Arguments | Returns |
|---|---|---|
| `streamText` | `prompt: string`, `options: GenerationOptions \| undefined`, `callbacks: StreamTextCallbacks` | `AbortController` (call `.abort()` to cancel the stream) |

`streamText` returns immediately; results arrive through the callbacks. For each stream, `onError` and `onDone` are mutually exclusive.

### `app/api/anthropic/stream/route.ts` (HTTP)

| Export | Arguments | Returns |
|---|---|---|
| `POST` | `Request` with JSON body `StreamRequestBody` (`{ prompt: string; options?: GenerationOptions }`) | `Response` with `Content-Type: application/x-ndjson`. HTTP 400 with a single `error` line if the body is invalid. |

Response body is newline-delimited JSON; each line is one of:

```
{ "type": "chunk", "text": string }
{ "type": "error", "error": AIError }
{ "type": "done" }
```

`client.ts` already parses this protocol. Only consume it manually if you are not using `streamText`.

### Types (from `types.ts`)

| Type | Shape |
|---|---|
| `GenerationOptions` | `{ model?: string; systemPrompt?: string; temperature?: number; maxTokens?: number }` |
| `StructuredOutputOptions` | `GenerationOptions & { schemaName: string; schema: Record<string, unknown> }` |
| `GenerateTextResult` | `{ text: string; model: string; stopReason: string \| null; usage: { inputTokens: number; outputTokens: number } }` |
| `GenerateStructuredOutputResult<T>` | `{ data: T; model: string; usage: { inputTokens: number; outputTokens: number } }` |
| `StreamTextCallbacks` | `{ onChunk: (text: string) => void; onError?: (error: AIError) => void; onDone?: () => void }` |
| `AIResult<T>` | `{ data: T; error?: never } \| { data?: never; error: AIError }`. Always check `result.error` first. |
| `AIError` | `{ code: AIErrorCode; message: string; retryAfter?: number }` |
| `AIErrorCode` | `"invalid_request" \| "authentication_error" \| "rate_limited" \| "overloaded" \| "network_error" \| "unknown_error"` |

### Defaults (constants in `types.ts`)

| Constant | Value | Notes |
|---|---|---|
| `DEFAULT_MODEL` | `"claude-sonnet-4-6"` | Used when `options.model` is omitted |
| `DEFAULT_MAX_TOKENS` | `1024` | Used when `options.maxTokens` is omitted |
| `DEFAULT_TEMPERATURE` | `1` | Anthropic accepts 0–1 |
| `RATE_LIMIT_DEFAULT_RETRY_AFTER_SECONDS` | `30` | Fallback `retryAfter` when the API sends no `retry-after` header |

### Behavior notes

- **Structured output:** Anthropic has no native JSON mode. `schema` is sent as a tool `input_schema` and the model is forced to call it, so the root of `schema` must be `{ type: "object", ... }`. `schemaName` becomes the tool name (short, snake_case).
- **Rate limits:** a 429 becomes `code: "rate_limited"` with `retryAfter` in seconds. Use it to disable the submit button or show a countdown.
- **Error mapping:** 401/403 → `authentication_error`, 429 → `rate_limited`, 529 → `overloaded`, 400 → `invalid_request`, connection failures → `network_error`, anything else → `unknown_error`.
- **Streaming vs Server Actions:** streaming is only available through `client.ts` + the route, because Server Actions cannot return a `ReadableStream`.

## Examples

### Generate text (server component)

```tsx
import { generateText } from "@/lib/ai/anthropic/text-generation/actions";

export default async function Page() {
  const result = await generateText("Explain quantum computing simply", {
    systemPrompt: "You are a friendly physics teacher.",
    temperature: 0.7,
    maxTokens: 500,
  });

  if (result.error) {
    return <p role="alert">{result.error.message}</p>;
  }

  return <p>{result.data.text}</p>;
}
```

### Structured output

```ts
import { generateStructuredOutput } from "@/lib/ai/anthropic/text-generation/actions";

type Person = { name: string; age: number };

const result = await generateStructuredOutput<Person>("John is 30 years old", {
  schemaName: "extract_person",
  schema: {
    type: "object",
    properties: {
      name: { type: "string" },
      age: { type: "number" },
    },
    required: ["name", "age"],
  },
});

if (!result.error) {
  console.log(result.data.data); // { name: "John", age: 30 }
}
```

### Streaming (client component)

```tsx
"use client";

import { useRef, useState } from "react";
import { streamText } from "@/lib/ai/anthropic/text-generation/client";

export function StreamDemo() {
  const [output, setOutput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  function handleGenerate() {
    setOutput("");
    setError(null);
    setIsStreaming(true);

    controllerRef.current = streamText(
      "Write a haiku about the ocean",
      { systemPrompt: "You are a poet.", temperature: 0.8 },
      {
        onChunk: (text) => setOutput((prev) => prev + text),
        onError: (err) => {
          setError(
            err.code === "rate_limited" && err.retryAfter
              ? `Too many requests. Try again in ${err.retryAfter}s.`
              : err.message
          );
          setIsStreaming(false);
        },
        onDone: () => setIsStreaming(false),
      }
    );
  }

  function handleCancel() {
    controllerRef.current?.abort();
    setIsStreaming(false);
  }

  return (
    <div>
      <button onClick={handleGenerate} disabled={isStreaming}>Generate</button>
      {isStreaming && <button onClick={handleCancel}>Cancel</button>}
      <p>{output}</p>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
```