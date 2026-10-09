# Vercel AI SDK (Gemini) — Tool Calling

Tool calling with the [Vercel AI SDK](https://sdk.vercel.ai) using Google Gemini as the provider. The app defines tools (name, description, Zod parameter schema, `execute` function), registers them once at startup, and the model decides when to call them. Supports multiple tools, multi-step runs (AI → tool → result → AI), tool argument validation against the Zod schema, and a per-call trace of results and errors.

```
AI → Tool → Database/API → Result → AI
```

Every function that can fail returns a normalized `AIResult<T>` (never throws), so results can be branched on `success` and errors rendered directly in the UI.

## Dependencies

| Package | Used for |
|---|---|
| `ai` | `generateText`, `tool`, `isStepCount`, `APICallError`, `InvalidToolInputError`, `NoSuchToolError` |
| `@ai-sdk/google` | Gemini provider (`google(modelId)`) |
| `zod` | Parameter schema of each tool |

`service.ts` limits the number of steps with `stopWhen: isStepCount(n)`. The AI SDK has renamed this helper across versions (`stepCountIs` → `isStepCount`); if the installed `ai` version does not export `isStepCount`, replace that import and call in `service.ts` with the name its version exports.

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `GOOGLE_GENERATIVE_AI_API_KEY` | Yes | Google AI (Gemini) API key. Read automatically by `@ai-sdk/google`. |

## File structure

```
lib/ai/vercel-sdk/tool-calling/
├── types.ts            # Types, defaults, rate limit + tool loop config
├── tools.ts            # Tool registry — app registers its tools here
├── service.ts          # Internal logic (builds AI SDK tools, runs the loop, rate limit, error normalization)
└── actions.ts          # Server Action — public API for server and Client Components
```

## Public API

Import from `@/lib/ai/vercel-sdk/tool-calling/actions` and `@/lib/ai/vercel-sdk/tool-calling/tools`. The Server Action can also be called directly from Client Components.

| File | Export | Arguments | Returns |
|---|---|---|---|
| `tools.ts` | `registerTool` | `tool: ToolDefinition` | `void` — registering a name twice replaces the previous tool |
| `tools.ts` | `registerTools` | `tools: ToolDefinition[]` | `void` |
| `actions.ts` | `runWithTools` | `params: RunWithToolsParams` | `Promise<AIResult<RunWithToolsResult>>` |

### Types

Imported from `@/lib/ai/vercel-sdk/tool-calling/types`.

**`ToolDefinition<TParams, TResult>`**

| Field | Type | Description |
|---|---|---|
| `name` | `string` | Unique name the model uses to call the tool |
| `description` | `string` | What the tool does and when to use it — the model reads this to decide |
| `parameters` | `ZodType<TParams>` | Schema the model's arguments are validated against |
| `execute` | `(params: TParams) => Promise<TResult> \| TResult` | Runs the tool (the Database/API call). Its return value is sent back to the model |

**`RunWithToolsParams`**

| Field | Type | Default |
|---|---|---|
| `prompt` | `string` | required |
| `system` | `string?` | — |
| `temperature` | `number?` | `0.7` |
| `maxTokens` | `number?` | `1024` |
| `model` | `string?` | `"gemini-1.5-pro"` |
| `toolNames` | `string[]?` | all registered tools |

**`RunWithToolsResult`** — `{ text: string; toolCalls: ToolCallTrace[]; finishReason: string; usage: { promptTokens: number; completionTokens: number; totalTokens: number } }`. `text` is the model's final answer after any tool calls.

**`ToolCallTrace`** — `{ toolName: string; args: unknown; result?: unknown; error?: string }`. Each entry has either `result` or `error`, never both.

**`AIResult<T>`** — `{ success: true; data: T } | { success: false; error: AIServiceError }`

**`AIServiceError`** — `{ code: "RATE_LIMITED" | "INVALID_REQUEST" | "PROVIDER_ERROR" | "TOOL_VALIDATION_ERROR" | "TOOL_EXECUTION_ERROR" | "UNKNOWN"; message: string; retryAfter?: number }`. `message` is safe to show in the UI; `retryAfter` (seconds) is only set for `RATE_LIMITED`.

### Behavior notes

- **Registration:** tools must be registered at app startup, before `runWithTools` is called. With no `toolNames`, every registered tool is available to the model.
- **Unknown tool names:** if `toolNames` contains a name that is not registered, `runWithTools` returns `INVALID_REQUEST` before any model call is made.
- **Validation errors stop the run:** if the model calls a tool with arguments that do not match its Zod schema, or calls a tool that was not made available, `runWithTools` returns `TOOL_VALIDATION_ERROR`.
- **Execution errors do not stop the run:** if a tool's `execute` throws, the failure is sent back to the model (which may retry, call another tool, or explain the failure) and is recorded as `error` in that call's `ToolCallTrace`. It is not returned as a top-level `AIResult` failure. `TOOL_EXECUTION_ERROR` is part of the `AIErrorCode` union but `runWithTools` does not return it.
- **Tool loop:** a single run takes at most `TOOL_LOOP_CONFIG.maxSteps` AI → tool → AI rounds (default `5`, in `types.ts`).
- **Trace:** `toolCalls` lists every tool call of the run in the order they finished.
- **Rate limiting:** a local in-memory sliding-window limiter (`RATE_LIMIT_CONFIG` in `types.ts`, default 20 requests/minute per server instance) runs before each provider call. A provider-side `429` is normalized to the same `RATE_LIMITED` code, with `retryAfter` when the provider sends a `retry-after` header.

## Examples

### Register a tool (server, at startup)

```ts
import { z } from "zod";
import { registerTool } from "@/lib/ai/vercel-sdk/tool-calling/tools";

registerTool({
  name: "getOrderStatus",
  description: "Look up the current status of a customer order by its ID.",
  parameters: z.object({
    orderId: z.string().describe("The order ID, e.g. 'ORD-1234'"),
  }),
  execute: async ({ orderId }) => {
    const order = await db.orders.findUnique({ where: { id: orderId } });
    if (!order) throw new Error(`Order ${orderId} not found`);
    return { status: order.status, updatedAt: order.updatedAt };
  },
});
```

### Register multiple tools

```ts
import { registerTools } from "@/lib/ai/vercel-sdk/tool-calling/tools";

registerTools([getOrderStatusTool, cancelOrderTool, listCustomerOrdersTool]);
```

### Run a prompt with tools (server)

```ts
import { runWithTools } from "@/lib/ai/vercel-sdk/tool-calling/actions";

const result = await runWithTools({
  prompt: "What's the status of order ORD-1234?",
  system: "You are a helpful customer support assistant.",
});

if (result.success) {
  console.log(result.data.text);

  for (const call of result.data.toolCalls) {
    console.log(call.toolName, call.args, call.result ?? call.error);
  }
} else {
  console.error(result.error.code, result.error.message);
}
```

### Restrict a run to specific tools

```ts
const result = await runWithTools({
  prompt: "What's the status of order ORD-1234?",
  toolNames: ["getOrderStatus"],
});
```

### Handle errors in the UI (Client Component)

```tsx
"use client";

import { useState } from "react";
import { runWithTools } from "@/lib/ai/vercel-sdk/tool-calling/actions";

export function AskAssistant() {
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleAsk(prompt: string) {
    setError(null);

    const result = await runWithTools({ prompt });

    if (!result.success) {
      setError(result.error.message);
      return;
    }

    setAnswer(result.data.text);
  }

  return (
    <div>
      <button onClick={() => handleAsk("What's the status of order ORD-1234?")}>
        Ask
      </button>
      {error ? <p role="alert">{error}</p> : <p>{answer}</p>}
    </div>
  );
}
```