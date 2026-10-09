# Anthropic Tool Calling

Tool calling with Claude through the official Anthropic SDK. You register tools (name, description, JSON schema and an `execute` function); `runWithTools` runs the full loop: the model decides which tools to call, the inputs are validated against each tool's schema, the tools run (database, external API, anything async), their results go back to the model, and the process repeats until the model returns its final text answer.

```
AI → Tool → Database/API → Result → AI
```

Every call returns a normalized `AIError` instead of throwing raw SDK errors, including rate limits and tool failures, so the UI can render it directly.

## Dependencies

- `@anthropic-ai/sdk`
- `ajv`

## Environment variables

| Variable | Required | Scope | Description |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | Server only | Anthropic API key. Read lazily by `service.ts`; if missing, the first call fails. |

## File structure

```
@/lib/ai/anthropic/tool-calling/
├── types.ts       # Shared types, defaults, error shapes
├── tools.ts       # Tool registry — the file you edit to register your tools
├── service.ts     # Internal tool-calling loop and validation. Never import it directly
└── actions.ts     # "use server" — public API (server components, server actions, and client components)

.env.local         # ANTHROPIC_API_KEY
```

Import base path used below: `@/lib/ai/anthropic/tool-calling`.

## Public API

### `actions.ts` (server)

| Export | Arguments | Returns |
|---|---|---|
| `runWithTools` | `prompt: string`, `options?: RunOptions` | `Promise<AIResult<RunResult>>` |

### `tools.ts` (registry)

| Export | Arguments | Returns |
|---|---|---|
| `registerTool` | `tool: Tool` (`{ definition: ToolDefinition; execute: (input) => Promise<unknown> }`) | `void`. Adds the tool to the registry; registering the same `name` again replaces the previous tool. |

Call `registerTool` at the bottom of `tools.ts` (below the "Register your tools below" marker) so every tool is registered as soon as `service.ts` imports the file.

### Types (from `types.ts`)

| Type | Shape |
|---|---|
| `RunOptions` | `{ model?: string; systemPrompt?: string; temperature?: number; maxTokens?: number; maxToolIterations?: number }` |
| `ToolDefinition` | `{ name: string; description: string; input_schema: Record<string, unknown> }` |
| `Tool<TInput, TOutput>` | `{ definition: ToolDefinition; execute: (input: TInput) => Promise<TOutput> }` |
| `ToolCallRecord` | `{ toolName: string; input: unknown; output?: unknown; error?: string }` |
| `RunResult` | `{ text: string; toolCalls: ToolCallRecord[]; model: string; stopReason: string \| null; usage: { inputTokens: number; outputTokens: number } }` |
| `AIResult<T>` | `{ data: T; error?: never } \| { data?: never; error: AIError }`. Always check `result.error` first. |
| `AIError` | `{ code: AIErrorCode; message: string; retryAfter?: number; toolName?: string }` |
| `AIErrorCode` | `"invalid_request" \| "authentication_error" \| "rate_limited" \| "overloaded" \| "network_error" \| "tool_validation_error" \| "tool_execution_error" \| "max_iterations_exceeded" \| "unknown_error"` |

### Defaults (constants in `types.ts`)

| Constant | Value | Notes |
|---|---|---|
| `DEFAULT_MODEL` | `"claude-sonnet-4-6"` | Used when `options.model` is omitted |
| `DEFAULT_MAX_TOKENS` | `1024` | Max tokens per model call |
| `DEFAULT_TEMPERATURE` | `1` | Anthropic accepts 0–1 |
| `DEFAULT_MAX_TOOL_ITERATIONS` | `5` | Max model↔tool round-trips per run; overridable with `options.maxToolIterations` |
| `RATE_LIMIT_DEFAULT_RETRY_AFTER_SECONDS` | `30` | Fallback `retryAfter` when the API sends no `retry-after` header |

### Behavior notes

- **The loop.** Each run sends the prompt plus all registered tools to the model. While the model requests tools, they are executed and the results are sent back. The run ends when the model answers without requesting a tool, or when `maxToolIterations` is reached (`max_iterations_exceeded`).
- **Multiple tools.** If the model requests several tools in one turn, they run sequentially in the order requested.
- **Validation.** Before `execute` runs, the model's input is validated with Ajv against the tool's `input_schema`. `execute` always receives validated input. `input_schema` must have `type: "object"` at the root, and tool `name` must match `^[a-zA-Z0-9_-]{1,64}$`. Use standard JSON Schema keywords only: `format` values such as `email` or `date-time` are not available, and an unsupported schema fails on the first call that uses it and surfaces as `unknown_error`.
- **Tool output.** The value returned by `execute` is sent to the model with `JSON.stringify`, so it must be JSON-serializable (return an object or value, never `undefined`). Keep it small and relevant; it consumes input tokens.
- **Errors stop the run.** A tool name that is not registered or invalid input returns `tool_validation_error`; an exception thrown inside `execute` returns `tool_execution_error` with the thrown message. Both include `error.toolName`, stop the run immediately, and are not sent back to the model for self-correction. When a run fails, only the `AIError` is returned, not the partial `toolCalls`.
- **Throw to signal failure.** Inside `execute`, throw an `Error` with a clear message for expected failures (record not found, upstream API down); no try/catch is needed.
- **Single prompt per run.** Each `runWithTools` call starts from the given `prompt` only; nothing is kept between calls.
- **Rate limits.** A 429 becomes `code: "rate_limited"` with `retryAfter` in seconds.
- **Error mapping.** 401/403 → `authentication_error`, 429 → `rate_limited`, 529 → `overloaded`, 400 → `invalid_request`, connection failures → `network_error`, anything else → `unknown_error`.

## Examples

### Register a tool (`tools.ts`)

```ts
registerTool({
  definition: {
    name: "get_order_status",
    description: "Look up the status of an order by its ID",
    input_schema: {
      type: "object",
      properties: {
        orderId: { type: "string", description: "The order ID" },
      },
      required: ["orderId"],
    },
  },
  execute: async (input: { orderId: string }) => {
    const order = await db.orders.findUnique({ where: { id: input.orderId } });
    if (!order) throw new Error(`Order ${input.orderId} not found`);
    return { status: order.status, updatedAt: order.updatedAt };
  },
});
```

### Register multiple tools (`tools.ts`)

```ts
registerTool({
  definition: {
    name: "get_weather",
    description: "Get the current weather for a city",
    input_schema: {
      type: "object",
      properties: { city: { type: "string" } },
      required: ["city"],
    },
  },
  execute: async (input: { city: string }) => {
    const res = await fetch(`https://api.example.com/weather?city=${encodeURIComponent(input.city)}`);
    if (!res.ok) throw new Error(`Weather API responded with ${res.status}`);
    return res.json();
  },
});

registerTool({
  definition: {
    name: "search_products",
    description: "Search the product catalog by keyword",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string" },
        limit: { type: "integer", minimum: 1, maximum: 20 },
      },
      required: ["query"],
    },
  },
  execute: async (input: { query: string; limit?: number }) => {
    return db.products.search(input.query, input.limit ?? 5);
  },
});
```

### Run a prompt with tools (server component / server action)

```tsx
import { runWithTools } from "@/lib/ai/anthropic/tool-calling/actions";

export default async function Page() {
  const result = await runWithTools("What's the status of order #4821?", {
    systemPrompt: "You are a support assistant. Use the tools to answer.",
    maxToolIterations: 3,
  });

  if (result.error) {
    return <p role="alert">{result.error.message}</p>;
  }

  return (
    <>
      <p>{result.data.text}</p>
      <pre>{JSON.stringify(result.data.toolCalls, null, 2)}</pre>
    </>
  );
}
```

### Handle errors by code

```ts
const result = await runWithTools(prompt);

if (result.error) {
  switch (result.error.code) {
    case "rate_limited":
      // result.error.retryAfter (seconds)
      break;
    case "tool_validation_error":
    case "tool_execution_error":
      // result.error.toolName tells you which tool failed
      break;
    case "max_iterations_exceeded":
      // the model kept requesting tools past maxToolIterations
      break;
    default:
      // authentication_error, overloaded, network_error, invalid_request, unknown_error
      break;
  }
}
```

### Call it from a client component

```tsx
"use client";

import { useState } from "react";
import { runWithTools } from "@/lib/ai/anthropic/tool-calling/actions";

export function AskForm() {
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleAsk(prompt: string) {
    setLoading(true);
    setError(null);
    const result = await runWithTools(prompt);
    setLoading(false);

    if (result.error) setError(result.error.message);
    else setAnswer(result.data.text);
  }

  return (
    <div>
      <button onClick={() => handleAsk("What's the status of order #4821?")} disabled={loading}>
        Ask
      </button>
      <p>{answer}</p>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
```