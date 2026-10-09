# Anthropic Chat

Multi-turn chat with Claude through the official Anthropic SDK: chat completion, streaming chat, multiple conversations with persisted message history, conversation management (create, list, rename, delete) and automatic context management. Persistence goes through a swappable `ChatStore` (an in-memory implementation is the default). Every function returns (or delivers through a callback) a normalized `AIError` instead of throwing raw SDK errors, including rate limits, so the UI can render it directly.

## Dependencies

- `@anthropic-ai/sdk`

## Environment variables

| Variable | Required | Scope | Description |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | Server only | Anthropic API key. Read lazily by `service.ts`; if missing, the first call fails. |

## File structure

```
@/lib/ai/anthropic/chat/
├── types.ts            # Shared types, defaults, error shapes (safe for server and client)
├── store.ts            # ChatStore contract + default in-memory implementation + setChatStore()
├── service.ts          # Internal Anthropic SDK logic and context management. Never import it directly
├── actions.ts          # "use server" — public API (server components, server actions, and client components)
├── client.ts           # Public API for client components (streaming)
└── stream/
    └── handler.ts      # Internal streaming request handler used by the route

app/api/anthropic/chat/stream/route.ts   # POST endpoint; delegates to stream/handler.ts
.env.local                               # ANTHROPIC_API_KEY
```

Import base path used below: `@/lib/ai/anthropic/chat`.

## Public API

### `actions.ts` (server)

| Export | Arguments | Returns |
|---|---|---|
| `sendMessage` | `conversationId: string`, `content: string`, `options?: GenerationOptions` | `Promise<AIResult<ChatCompletionResult>>` |
| `createConversation` | `title?: string` (default `"New conversation"`) | `Promise<Conversation>` |
| `getConversation` | `conversationId: string` | `Promise<ConversationWithMessages \| null>` (`null` if it does not exist) |
| `listConversations` | none | `Promise<Conversation[]>` (most recently updated first) |
| `renameConversation` | `conversationId: string`, `title: string` | `Promise<void>` |
| `deleteConversation` | `conversationId: string` | `Promise<void>` (also removes its messages) |

Only `sendMessage` calls the model, so it is the only one that returns `AIResult`. The rest return plain values and throw only if your `ChatStore` throws.

### `client.ts` (client)

| Export | Arguments | Returns |
|---|---|---|
| `streamMessage` | `conversationId: string`, `content: string`, `options: GenerationOptions \| undefined`, `callbacks: StreamMessageCallbacks` | `AbortController` (call `.abort()` to cancel the stream) |

`streamMessage` returns immediately; the assistant's reply arrives through the callbacks. For each stream, `onError` and `onDone` are mutually exclusive.

### `app/api/anthropic/chat/stream/route.ts` (HTTP)

| Export | Arguments | Returns |
|---|---|---|
| `POST` | `Request` with JSON body `StreamChatRequestBody` (`{ conversationId: string; content: string; options?: GenerationOptions }`) | `Response` with `Content-Type: application/x-ndjson`. HTTP 400 with a single `error` line if the body is invalid. |

Response body is newline-delimited JSON; each line is one of:

```
{ "type": "chunk", "text": string }
{ "type": "error", "error": AIError }
{ "type": "done" }
```

`client.ts` already parses this protocol. Only consume it manually if you are not using `streamMessage`.

### `store.ts` (persistence)

| Export | Arguments | Returns |
|---|---|---|
| `setChatStore` | `store: ChatStore` | `void`. Replaces the active store. Call it once at server startup, before the first request. |
| `ChatStore` (interface) | implemented by you | Contract below |

`ChatStore` contract (what a custom implementation must satisfy):

| Method | Arguments | Returns | Requirements |
|---|---|---|---|
| `createConversation` | `title?: string` | `Promise<Conversation>` | Generates the conversation `id` and ISO timestamps. Default title `"New conversation"`. |
| `getConversation` | `conversationId: string` | `Promise<ConversationWithMessages \| null>` | Returns `null` (never throws) when missing. `messages` in chronological order. |
| `listConversations` | none | `Promise<Conversation[]>` | Sorted by `updatedAt`, newest first. |
| `updateConversationTitle` | `conversationId: string`, `title: string` | `Promise<void>` | Bumps `updatedAt`. |
| `deleteConversation` | `conversationId: string` | `Promise<void>` | Deletes its messages too. |
| `addMessage` | `conversationId: string`, `message: ChatMessage` | `Promise<void>` | `message` already has `id` and `createdAt`. Bumps the conversation's `updatedAt`. |
| `getMessages` | `conversationId: string` | `Promise<ChatMessage[]>` | Chronological order. |

The default in-memory store is lost on server restart and is not shared across server instances.

### Types (from `types.ts`)

| Type | Shape |
|---|---|
| `GenerationOptions` | `{ model?: string; systemPrompt?: string; temperature?: number; maxTokens?: number; maxContextTokens?: number }` |
| `MessageRole` | `"user" \| "assistant"` |
| `ChatMessage` | `{ id: string; role: MessageRole; content: string; createdAt: string }` |
| `Conversation` | `{ id: string; title: string; createdAt: string; updatedAt: string }` |
| `ConversationWithMessages` | `Conversation & { messages: ChatMessage[] }` |
| `ChatCompletionResult` | `{ message: ChatMessage; model: string; stopReason: string \| null; usage: { inputTokens: number; outputTokens: number } }` (`message` is the persisted assistant reply) |
| `StreamMessageCallbacks` | `{ onChunk: (text: string) => void; onError?: (error: AIError) => void; onDone?: () => void }` |
| `AIResult<T>` | `{ data: T; error?: never } \| { data?: never; error: AIError }`. Always check `result.error` first. |
| `AIError` | `{ code: AIErrorCode; message: string; retryAfter?: number }` |
| `AIErrorCode` | `"invalid_request" \| "authentication_error" \| "rate_limited" \| "overloaded" \| "network_error" \| "not_found" \| "unknown_error"` |

### Defaults (constants in `types.ts`)

| Constant | Value | Notes |
|---|---|---|
| `DEFAULT_MODEL` | `"claude-sonnet-4-6"` | Used when `options.model` is omitted |
| `DEFAULT_MAX_TOKENS` | `1024` | Max tokens generated per reply |
| `DEFAULT_TEMPERATURE` | `1` | Anthropic accepts 0–1 |
| `DEFAULT_MAX_CONTEXT_TOKENS` | `150000` | Overridable per call with `options.maxContextTokens` |
| `RATE_LIMIT_DEFAULT_RETRY_AFTER_SECONDS` | `30` | Fallback `retryAfter` when the API sends no `retry-after` header |

### Behavior notes

- **Options are not stored.** `systemPrompt`, `model`, `temperature` and the rest are not saved with the conversation; pass them on every `sendMessage` / `streamMessage` call.
- **Message persistence order.** The user message is saved before the model is called, so it stays in history even if the call fails. The assistant reply is saved only when the call (or the stream) completes successfully; a failed or interrupted stream saves nothing for the assistant.
- **Streaming result.** `streamMessage` delivers text only. To get the persisted assistant message (with its `id`), call `getConversation` after `onDone`. Actions can be imported and called from client components.
- **Context management.** Before each request the history is measured with the Anthropic token-counting endpoint and the oldest messages are dropped until it fits `maxContextTokens`. The most recent message is always kept. Trimming only affects what is sent to the model; the store keeps the full history.
- **`not_found`.** `sendMessage` and `streamMessage` return/deliver `code: "not_found"` when `conversationId` does not exist. In that case the model is not called.
- **Rate limits.** A 429 becomes `code: "rate_limited"` with `retryAfter` in seconds. Use it to disable the submit button or show a countdown.
- **Error mapping.** 401/403 → `authentication_error`, 429 → `rate_limited`, 529 → `overloaded`, 400 → `invalid_request`, connection failures → `network_error`, anything else → `unknown_error`.
- **Streaming vs Server Actions.** Streaming is only available through `client.ts` + the route, because Server Actions cannot return a `ReadableStream`.

## Examples

### Create a conversation and send a message (server component / server action)

```tsx
import { createConversation, sendMessage } from "@/lib/ai/anthropic/chat/actions";

export default async function Page() {
  const conversation = await createConversation("Trip planning");

  const result = await sendMessage(conversation.id, "Suggest a 5-day itinerary for Japan", {
    systemPrompt: "You are a helpful travel assistant.",
    maxTokens: 800,
  });

  if (result.error) {
    return <p role="alert">{result.error.message}</p>;
  }

  return <p>{result.data.message.content}</p>;
}
```

### List conversations and load one with its history

```tsx
import { listConversations, getConversation } from "@/lib/ai/anthropic/chat/actions";

export default async function Sidebar({ activeId }: { activeId?: string }) {
  const conversations = await listConversations();
  const active = activeId ? await getConversation(activeId) : null;

  return (
    <>
      <ul>
        {conversations.map((c) => (
          <li key={c.id}>{c.title}</li>
        ))}
      </ul>
      {active?.messages.map((m) => (
        <p key={m.id}>
          <strong>{m.role}:</strong> {m.content}
        </p>
      ))}
    </>
  );
}
```

### Rename and delete

```ts
import { renameConversation, deleteConversation } from "@/lib/ai/anthropic/chat/actions";

await renameConversation(conversationId, "Japan trip");
await deleteConversation(conversationId);
```

### Streaming chat (client component)

```tsx
"use client";

import { useRef, useState } from "react";
import { streamMessage } from "@/lib/ai/anthropic/chat/client";
import { getConversation } from "@/lib/ai/anthropic/chat/actions";
import type { ChatMessage } from "@/lib/ai/anthropic/chat/types";

export function ChatWindow({
  conversationId,
  initialMessages,
}: {
  conversationId: string;
  initialMessages: ChatMessage[];
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [reply, setReply] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  function handleSend(content: string) {
    setReply("");
    setError(null);
    setIsStreaming(true);

    controllerRef.current = streamMessage(
      conversationId,
      content,
      { systemPrompt: "You are a helpful assistant." },
      {
        onChunk: (text) => setReply((prev) => prev + text),
        onError: (err) => {
          setError(
            err.code === "rate_limited" && err.retryAfter
              ? `Too many requests. Try again in ${err.retryAfter}s.`
              : err.message
          );
          setIsStreaming(false);
        },
        onDone: async () => {
          // Reload the persisted history (includes the new assistant message with its id)
          const conversation = await getConversation(conversationId);
          if (conversation) setMessages(conversation.messages);
          setReply("");
          setIsStreaming(false);
        },
      }
    );
  }

  return (
    <div>
      {messages.map((m) => (
        <p key={m.id}>
          <strong>{m.role}:</strong> {m.content}
        </p>
      ))}
      {isStreaming && <p>{reply}</p>}
      {error && <p role="alert">{error}</p>}
      {isStreaming && <button onClick={() => controllerRef.current?.abort()}>Stop</button>}
    </div>
  );
}
```

### Plug in your own persistence

```ts
// e.g. lib/ai/anthropic/chat/my-store.ts
import type { ChatStore } from "@/lib/ai/anthropic/chat/store";
import { setChatStore } from "@/lib/ai/anthropic/chat/store";
import type { ChatMessage } from "@/lib/ai/anthropic/chat/types";

class MyChatStore implements ChatStore {
  async createConversation(title = "New conversation") { /* insert row, return Conversation */ }
  async getConversation(conversationId: string) { /* return ConversationWithMessages | null */ }
  async listConversations() { /* order by updatedAt desc */ }
  async updateConversationTitle(conversationId: string, title: string) { /* update row */ }
  async deleteConversation(conversationId: string) { /* delete conversation + messages */ }
  async addMessage(conversationId: string, message: ChatMessage) { /* insert message, bump updatedAt */ }
  async getMessages(conversationId: string) { /* order by createdAt asc */ }
}

// Call once at server startup, before the first request
setChatStore(new MyChatStore());
```