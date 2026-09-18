# Anthropic Text Generation — Setup

Drop-in text generation module for Next.js App Router using the Anthropic API.

## What's included

- Generate text (non-streaming)
- Streaming text
- System prompts
- Configurable temperature / max tokens / model
- Structured output (JSON, via forced tool use)
- Normalized error handling (including rate limiting) ready for the UI

Not included by design: agents, image generation, chat/conversation history, tool calling for general use. See the separate modules for those.

## Dependencies

This module uses:

- [`@anthropic-ai/sdk`](https://www.npmjs.com/package/@anthropic-ai/sdk)

Not installed automatically — add it to your project's `package.json` as you normally would.

## File map

| File | Runs on | What it's for |
|---|---|---|
| `types.ts` | both | Shared types, defaults, error shapes |
| `service.ts` | server | Internal Anthropic SDK calls + error normalization. Don't import directly. |
| `actions.ts` | server | Server Actions — import into server components |
| `client.ts` | client | Client-side streaming — import into client components |
| `stream/handler.ts` | server | Internal streaming request handler |
| `stream/route.ts` | server | Copy to `app/api/anthropic/stream/route.ts` |
| `.env.local` | — | Environment variables |

## Setup

1. Copy all files into your project (suggested location: `lib/ai/anthropic/text-generation/`).
2. Copy `stream/route.ts` to `app/api/anthropic/stream/route.ts` (it imports `./handler`, which you should copy alongside it, e.g. to `app/api/anthropic/stream/handler.ts`, updating the import path in `route.ts` accordingly — or keep `handler.ts` in your lib folder and import it from there instead).
3. Add your key to `.env.local`:
   ```
   ANTHROPIC_API_KEY=sk-ant-...
   ```
4. Make sure `@anthropic-ai/sdk` is in your dependencies.

## Usage

### Generate text (server component / server action)

```ts
import { generateText } from "@/lib/ai/anthropic/text-generation/actions";

const result = await generateText("Explain quantum computing simply", {
  systemPrompt: "You are a friendly physics teacher.",
  temperature: 0.7,
});

if (result.error) {
  // result.error.code, result.error.message (and result.error.retryAfter if rate_limited)
} else {
  console.log(result.data.text);
}
```

### Structured output (server component / server action)

```ts
import { generateStructuredOutput } from "@/lib/ai/anthropic/text-generation/actions";

const result = await generateStructuredOutput("John is 30 years old", {
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

### Streaming text (client component)

```tsx
"use client";

import { useState } from "react";
import { streamText } from "@/lib/ai/anthropic/text-generation/client";

export function ChatDemo() {
  const [output, setOutput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleGenerate() {
    setOutput("");
    setError(null);
    setIsStreaming(true);

    streamText("Write a haiku about the ocean", undefined, {
      onChunk: (text) => setOutput((prev) => prev + text),
      onError: (err) => setError(err.message),
      onDone: () => setIsStreaming(false),
    });
  }

  return (
    <div>
      <button onClick={handleGenerate} disabled={isStreaming}>
        Generate
      </button>
      <p>{output}</p>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
```

## Error handling

Every function (`generateText`, `generateStructuredOutput`, `streamText`) returns/delivers a normalized error instead of throwing raw SDK exceptions:

```ts
type AIErrorCode =
  | "invalid_request"
  | "authentication_error"
  | "rate_limited"
  | "overloaded"
  | "network_error"
  | "unknown_error";

interface AIError {
  code: AIErrorCode;
  message: string;
  retryAfter?: number; // present when code === "rate_limited"
}
```

Rate limiting (`code: "rate_limited"`) includes `retryAfter` (seconds) when the API provides it, so you can disable the UI's submit button or show a countdown until it's safe to retry.
