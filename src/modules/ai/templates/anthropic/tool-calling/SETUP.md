# Anthropic Tool Calling — Setup

Drop-in tool calling module for Next.js App Router using the Anthropic API. Separate and independent from the Text Generation and Chat modules.

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

## What's included

- Define tools (schema + execution logic)
- Multiple tools
- Tool execution with input validation against each tool's schema
- Tool results fed back to the model
- Tool error handling (validation errors, execution errors, iteration cap)

## Dependencies

This module uses:

- [`@anthropic-ai/sdk`](https://www.npmjs.com/package/@anthropic-ai/sdk)
- [`ajv`](https://www.npmjs.com/package/ajv) — JSON schema validation for tool inputs

Not installed automatically — add them to your project's `package.json` as you normally would.

## File map

| File | Runs on | What it's for |
|---|---|---|
| `types.ts` | both | Shared types, defaults, error shapes |
| `tools.ts` | server | **Edit this.** Register your tools here (schema + execution logic) |
| `service.ts` | server | Internal model↔tool loop, validation, error normalization |
| `actions.ts` | server | Server Action — import into server components |
| `.env.local` | — | Environment variables |

## Setup

1. Copy all files into your project (suggested location: `lib/ai/anthropic/tool-calling/`).
2. Add your key to `.env.local`:
   ```
   ANTHROPIC_API_KEY=sk-ant-...
   ```
3. Make sure `@anthropic-ai/sdk` and `ajv` are in your dependencies.
4. Register your tools in `tools.ts` (see below).

## Registering a tool

Add this at the bottom of `tools.ts`:

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

- `input_schema` is a standard JSON schema — it's both what the model sees to decide how to call the tool, and what `service.ts` validates the model's input against before running `execute()`.
- Throwing inside `execute()` stops the run and surfaces a `tool_execution_error` — no need to handle errors yourself beyond throwing.

## Usage

### Run a prompt with tools available (server component / server action)

```ts
import { runWithTools } from "@/lib/ai/anthropic/tool-calling/actions";

const result = await runWithTools("What's the status of order #4821?");

if (result.error) {
  // result.error.code, result.error.message, result.error.toolName (if tool-related)
} else {
  console.log(result.data.text);       // the model's final answer
  console.log(result.data.toolCalls);  // [{ toolName, input, output }]
}
```

## Error handling

```ts
type AIErrorCode =
  | "invalid_request"
  | "authentication_error"
  | "rate_limited"
  | "overloaded"
  | "network_error"
  | "tool_validation_error"
  | "tool_execution_error"
  | "max_iterations_exceeded"
  | "unknown_error";

interface AIError {
  code: AIErrorCode;
  message: string;
  retryAfter?: number; // present when code === "rate_limited"
  toolName?: string;   // present for tool_validation_error / tool_execution_error
}
```

The loop stops immediately on the first tool validation or execution error — it does not retry or ask the model to self-correct. `max_iterations_exceeded` means the model kept requesting tools past `DEFAULT_MAX_TOOL_ITERATIONS` (5, overridable via `options.maxToolIterations`) — usually a sign a tool is stuck in a loop or a prompt needs adjusting.
