# OpenAI Tool Calling

Tool calling with the OpenAI SDK for Next.js (App Router). Runs the loop AI → Tool → Database/API → Result → AI: you define tools with a JSON Schema and an `execute` function, the model decides which to call (one or several per run), arguments are validated before execution, results are fed back to the model, and the final reply is returned together with a record of every tool call. It takes a plain `{ role, content }[]` message array, so it plugs into any chat implementation.

## Dependencies

- `openai`
- `ajv`
- `server-only`

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `OPENAI_API_KEY` | Yes | OpenAI API key. Read on the server only. |

## File structure

```
lib/ai/openai/tool-calling/
├── actions.ts   # "use server" — public entrypoint (runWithToolsAction)
├── tools.ts     # defineTool helper. Define your own tools with it (this is the file you customize)
├── service.ts   # Internal — the AI ↔ tool loop, ajv validation, error normalization. Never import directly.
└── types.ts     # Types, defaults (model, tokens, temperature, max round trips) and rate limit config
```

## Public API

### `actions.ts` — `@/lib/ai/openai/tool-calling/actions`

Server-side (also callable from Client Components as a Server Action). Never throws: always check `result.ok`.

| Export | Arguments | Returns |
|---|---|---|
| `runWithToolsAction` | `options: RunWithToolsOptions` | `Promise<AIActionResult<RunWithToolsResult>>` |

### `tools.ts` — `@/lib/ai/openai/tool-calling/tools`

| Export | Arguments | Returns |
|---|---|---|
| `defineTool<TArgs, TResult>` | `tool: ToolDefinition<TArgs, TResult>` | `ToolDefinition<TArgs, TResult>` — identity helper, only for type inference |
| `createToolRegistry` | `tools: ToolDefinition[]` | `Map<string, ToolDefinition>` — called internally by each run; throws on duplicate tool names. No need to call it. |

### Types — `@/lib/ai/openai/tool-calling/types`

```ts
interface ToolChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ToolDefinition<TArgs = Record<string, unknown>, TResult = unknown> {
  name: string;                        // unique; the model uses it to call the tool
  description: string;                 // main signal the model uses to decide when to call it
  parameters: Record<string, unknown>; // JSON Schema (type: "object") for the arguments
  execute: (args: TArgs) => Promise<TResult>; // your DB/API call. Throw to signal failure.
}

interface RunWithToolsOptions {
  messages: ToolChatMessage[];   // include the system prompt here as a { role: "system" } message
  tools: ToolDefinition[];
  model?: string;                // default "gpt-4o-mini"
  temperature?: number;          // default 0.7
  maxOutputTokens?: number;      // default 1024, capped at 4096
  maxToolRoundtrips?: number;    // default 5
}

interface ExecutedToolCall {
  toolName: string;
  args: Record<string, unknown>;
  result: unknown;
}

interface RunWithToolsResult {
  text: string;                  // the model's final reply
  toolCalls: ExecutedToolCall[]; // every tool executed, in order
  model: string;
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number }; // last model call only
}

type AIActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: AIActionError };

interface AIActionError {
  code:
    | "RATE_LIMITED" | "INVALID_REQUEST" | "AUTH_ERROR" | "TIMEOUT"
    | "TOOL_NOT_FOUND" | "TOOL_VALIDATION_ERROR" | "TOOL_EXECUTION_ERROR"
    | "UNKNOWN";
  message: string;      // safe to show in the UI
  retryable: boolean;
  retryAfter?: number;  // seconds — only set for RATE_LIMITED
  toolName?: string;    // set for TOOL_* codes
}
```

### Behavior

- **Loop:** each round sends `messages` and the tool schemas to the model. If the model replies with text, the run ends. If it requests tools, they run one at a time in the requested order: lookup by name, parse the JSON arguments, validate them against `parameters` with `ajv`, call `execute`, and send the result back to the model as the tool message.
- **A tool failure stops the run immediately** and returns `{ ok: false, error }`. The error is not fed back to the model.
  - `TOOL_NOT_FOUND`: the model requested a tool name that is not in `tools`.
  - `TOOL_VALIDATION_ERROR`: the arguments were not valid JSON or did not match the schema; `message` lists what failed.
  - `TOOL_EXECUTION_ERROR`: `execute` threw; `message` is the thrown error's message.
- **No rollback:** tools that already ran before the failure keep their side effects, and their `toolCalls` are not included in the error result.
- **Tool results** are sent to the model with `JSON.stringify`, so `execute` must return a JSON-serializable value. Return `undefined` and the request to OpenAI is rejected (`INVALID_REQUEST`); return something like `{ ok: true }` for tools with no data.
- **Unique names:** two tools with the same `name` make the run fail with `UNKNOWN`.
- **Round trip limit:** `maxToolRoundtrips` caps how many times the model can request tools. If it is reached while the model still wants tools, the run returns the last text it has, which is often an empty string.
- **Rate limit:** each model call retries a 429 up to 2 times with exponential backoff. If retries run out, the result is `RATE_LIMITED` with `retryAfter` in seconds (20 by default).
- **Persistence:** nothing is stored. The caller owns the message history, appends `result.data.text` as the assistant reply, and decides whether to keep `toolCalls`.

## Examples

### Define a tool

```ts
import { defineTool } from "@/lib/ai/openai/tool-calling/tools";

export const getOrderStatus = defineTool({
  name: "get_order_status",
  description: "Look up the current status of a customer's order by order id",
  parameters: {
    type: "object",
    properties: {
      orderId: { type: "string" },
    },
    required: ["orderId"],
    additionalProperties: false,
  },
  execute: async ({ orderId }: { orderId: string }) => {
    // Replace with your real DB/API call.
    return { orderId, status: "shipped" };
  },
});
```

### Run the loop with multiple tools (server)

```ts
import { runWithToolsAction } from "@/lib/ai/openai/tool-calling/actions";
import { getOrderStatus } from "./tools/get-order-status";
import { getRefundPolicy } from "./tools/get-refund-policy";

const result = await runWithToolsAction({
  messages: [
    { role: "system", content: "You are a helpful customer support assistant." },
    { role: "user", content: "Where is order 12345, and can I return it?" },
  ],
  tools: [getOrderStatus, getRefundPolicy],
  maxToolRoundtrips: 3,
});

if (result.ok) {
  console.log(result.data.text);      // final reply
  console.log(result.data.toolCalls); // [{ toolName, args, result }, ...]
}
```

### Handle tool errors

```ts
if (!result.ok) {
  switch (result.error.code) {
    case "TOOL_VALIDATION_ERROR":
    case "TOOL_EXECUTION_ERROR":
    case "TOOL_NOT_FOUND":
      console.error(`Tool "${result.error.toolName}" failed: ${result.error.message}`);
      break;
    case "RATE_LIMITED":
      console.log(`Retry in ${result.error.retryAfter}s`);
      break;
    default:
      console.error(result.error.message);
  }
}
```

### Use it inside an existing chat

```ts
import { runWithToolsAction } from "@/lib/ai/openai/tool-calling/actions";

// `history` is whatever your chat stores: map it to { role, content }.
const messages = [
  { role: "system" as const, content: "You are a helpful assistant." },
  ...history.map(({ role, content }) => ({ role, content })),
  { role: "user" as const, content: newUserMessage },
];

const result = await runWithToolsAction({ messages, tools: [getOrderStatus] });

if (result.ok) {
  // Save result.data.text as the assistant message with your own persistence.
}
```