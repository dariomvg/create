# OpenAI Tool Calling — Setup

Drop-in tool calling module for Next.js (App Router) using the OpenAI SDK.
Runs the AI ↔ tool execution loop:

```
AI → Tool → Database/API → Result → AI
```

This is a **separate, independent module** — it doesn't import from or
depend on the Text Generation or Chat modules. It's deliberately agnostic
about where message history comes from: you pass in whatever messages your
own chat implementation manages, and get back the model's final reply plus
a record of every tool it called.

## Dependencies

- `openai` — official OpenAI SDK
- `ajv` — JSON Schema validator, used to validate tool arguments returned by the model before executing them

## Environment variables

See `.env.local`:

- `OPENAI_API_KEY` — required.

## File structure

```
lib/openai-tools/
├── types.ts          # Types, default model/token config, rate limit config
├── tools.ts             # Customize here: define your tools with `defineTool`
├── service.ts             # Internal — SDK calls, the AI ↔ tool loop, ajv validation, error normalization
├── actions.ts               # "use server" — single public entrypoint (runWithToolsAction)
└── .env.local
```

## Setup steps

1. Copy the `lib/openai-tools/` folder into your project.
2. Set `OPENAI_API_KEY` in your project's `.env.local`.
3. Define your tools (see below) and pass them into `runWithToolsAction` from wherever your chat backend lives.

## Usage

### Defining tools

Use `defineTool` from `tools.ts` for parameter/result type inference. Each
tool needs a JSON Schema for its parameters and an `execute` function that
does the real work (call your DB/API):

```ts
import { defineTool } from "@/lib/openai-tools/tools";

const getOrderStatus = defineTool({
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

### Running the loop

```ts
import { runWithToolsAction } from "@/lib/openai-tools/actions";

const result = await runWithToolsAction({
  messages: [
    { role: "system", content: "You are a helpful customer support assistant." },
    { role: "user", content: "Where's my order #12345?" },
  ],
  tools: [getOrderStatus],
});

if (result.ok) {
  console.log(result.data.text); // model's final reply
  console.log(result.data.toolCalls); // every tool call executed, with args + result
} else {
  console.error(result.error.code, result.error.message, result.error.toolName);
}
```

### Integrating with an external chat

`messages` is intentionally just `{ role, content }[]` — map your chat's own
message history (e.g. from a database, or from the OpenAI Chat module) into
that shape before calling `runWithToolsAction`, and append `result.data.text`
as the assistant's reply using however your chat persists messages.

## Error handling

Same normalized shape as the other modules, with three tool-specific codes:

```ts
interface AIActionError {
  code:
    | "RATE_LIMITED"
    | "INVALID_REQUEST"
    | "AUTH_ERROR"
    | "TIMEOUT"
    | "TOOL_NOT_FOUND"
    | "TOOL_VALIDATION_ERROR"
    | "TOOL_EXECUTION_ERROR"
    | "UNKNOWN";
  message: string;
  retryable: boolean;
  retryAfter?: number; // seconds, only set for RATE_LIMITED
  toolName?: string; // set for TOOL_* codes
}
```

- `runWithToolsAction` never throws — it returns `{ ok: false, error }`.
- **If a tool fails (unknown tool, invalid arguments, or the `execute`
  function throws), the loop stops immediately** — the error is returned to
  your app, it is not fed back to the model to let it try recovering on its
  own. If you want the model to see and react to tool failures instead,
  you'd need to change the loop in `service.ts` to push the error as the
  tool's result message instead of throwing.

## Rate limiting

Same approach as the other modules: automatic retry on a 429 with
exponential backoff (see `RATE_LIMIT_CONFIG` in `types.ts`). If retries are
exhausted, the error surfaces as `RATE_LIMITED` with a `retryAfter` in
seconds.

## Round trip limit

`maxToolRoundtrips` (default: `DEFAULT_MAX_TOOL_ROUNDTRIPS` in `types.ts`)
caps how many times the model can call tools before this module gives up
and returns whatever text reply it has — this prevents an unbounded loop if
the model keeps requesting tools indefinitely.
