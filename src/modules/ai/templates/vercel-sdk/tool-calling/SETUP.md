# Vercel AI SDK — Tool Calling Module

A self-contained module for tool calling using the [Vercel AI SDK](https://sdk.vercel.ai) with **Google (Gemini)** as the provider. Covers defining tools, tool schemas, tool execution, multiple tools, tool results, tool validation, and tool errors.

Standalone — does not depend on the `vercel-ai-sdk-text-generation` or `vercel-ai-sdk-chat` modules. No streaming, so there's no `client.ts` — `actions.ts` is called directly from Server or Client Components.

## Conceptual flow

```
AI
 ↓
Tool
 ↓
Database/API
 ↓
Result
 ↓
AI
```

The model decides when to call a tool and with what arguments. Your `execute` function is where the actual Database/API call happens. The result goes back to the model, which can call another tool or produce its final answer — up to `TOOL_LOOP_CONFIG.maxSteps` rounds.

## Dependencies

- `ai` — the Vercel AI SDK core (`generateText`, `tool`, `isStepCount`, and the tool-related error classes)
- `@ai-sdk/google` — the Google (Gemini) provider adapter
- `zod` — used to define each tool's parameter schema

> **Version note:** the AI SDK has renamed its step-limiting helper more than once (`maxSteps` → `stepCountIs` → `isStepCount`). This module uses `isStepCount`. If your installed `ai` version doesn't export it, swap the import in `service.ts` for whichever of the two is available in your version — the usage (`isStepCount(n)` passed to `stopWhen`) is otherwise identical.

## File structure

```
types.ts       ToolDefinition contract, run params/result, tool loop config, errors
tools.ts        Tool registry — register your own tools here
service.ts      Internal logic: builds AI SDK tools, runs the loop, normalizes errors — do not modify
actions.ts      Server Action — import into Server or Client Components
.env.local        Environment variable for the Google API key
```

## Setup

1. **Define and register your tools.** Each tool needs a name, a description (the model reads this to decide when to use it), a Zod schema for its parameters, and an `execute` function — this is where you call your actual Database/API.

   ```ts
   import { z } from "zod";
   import { registerTool } from "@/lib/ai-tools/tools";

   registerTool({
     name: "getOrderStatus",
     description: "Look up the current status of a customer order by its ID.",
     parameters: z.object({
       orderId: z.string().describe("The order ID, e.g. 'ORD-1234'"),
     }),
     execute: async ({ orderId }) => {
       // Replace with your real Database/API call.
       const order = await db.orders.findUnique({ where: { id: orderId } });
       if (!order) throw new Error(`Order ${orderId} not found`);
       return { status: order.status, updatedAt: order.updatedAt };
     },
   });
   ```

   Register this during app startup, the same way you'd register a `ConversationStore` in the chat module.

2. Add your Google AI API key to `.env.local`. Get one at https://aistudio.google.com/apikey

## Usage

```ts
import { runWithTools } from "@/lib/ai-tools/actions";

const result = await runWithTools({
  prompt: "What's the status of order ORD-1234?",
  system: "You are a helpful customer support assistant.",
});

if (result.success) {
  console.log(result.data.text); // the model's final answer

  for (const call of result.data.toolCalls) {
    console.log(call.toolName, call.args, call.result ?? call.error);
  }
} else {
  console.error(result.error.message);
}
```

`result.data.toolCalls` is the full trace of every tool call made during the run, in order — each entry has either a `result` or an `error`, never both. This is what "Tool results" and "Tool errors" resolve to: you get to see exactly what happened at each Database/API step, not just the model's final text.

### Limiting which tools are available

By default, every registered tool is available to the model. To restrict a specific run to a subset:

```ts
const result = await runWithTools({
  prompt: "What's the status of order ORD-1234?",
  toolNames: ["getOrderStatus"],
});
```

If you pass a name that isn't registered, the call fails with `INVALID_REQUEST` before any model call is made.

## Error handling

```ts
{
  code:
    | "RATE_LIMITED"
    | "INVALID_REQUEST"
    | "PROVIDER_ERROR"
    | "TOOL_VALIDATION_ERROR"
    | "TOOL_EXECUTION_ERROR"
    | "UNKNOWN",
  message: string,       // safe to show in the UI
  retryAfter?: number,   // seconds, only present for RATE_LIMITED
}
```

- `TOOL_VALIDATION_ERROR` — the model called a tool with arguments that don't match its Zod schema, or tried to call a tool that wasn't made available to it. This stops the run.
- A failed `execute` (your Database/API call throwing) does **not** stop the run — the AI SDK feeds the failure back to the model so it can retry, use another tool, or explain the failure to the user. You'll see it as an `error` entry in that tool's `ToolCallTrace`, not as a top-level `AIResult` failure.

## Rate limiting

Same in-memory sliding-window limiter as the other modules (`RATE_LIMIT_CONFIG` in `types.ts`, default 20 requests/minute per server instance), plus normalized handling of the provider's own 429 responses.

## Tool loop

`TOOL_LOOP_CONFIG.maxSteps` in `types.ts` (default 5) caps how many AI → Tool → AI round trips a single `runWithTools` call can take. Raise it if your use case needs to chain more tool calls before answering; lower it to fail fast on runaway loops.
