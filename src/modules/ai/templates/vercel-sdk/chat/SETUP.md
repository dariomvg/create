# Vercel AI SDK (Gemini) — Chat

Chat with the [Vercel AI SDK](https://sdk.vercel.ai) using Google Gemini as the provider. Supports chat completion, streaming chat, conversations with message history, multiple conversations, conversation management (create, list, get, rename, delete), and context management (only the most recent messages are sent to the model). Speech-to-text and text-to-speech are exposed as stubs that return `NOT_IMPLEMENTED`.

Persistence is storage-agnostic: the module defines a `ConversationStore` contract and the app registers its own implementation (Supabase, Prisma, etc.) once at startup. Every function returns a normalized `AIResult<T>` (never throws), so results can be branched on `success` and errors rendered directly in the UI.

## Dependencies

| Package | Used for |
|---|---|
| `ai` | `generateText`, `streamText`, `APICallError` |
| `@ai-sdk/google` | Gemini provider (`google(modelId)`) |

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `GOOGLE_GENERATIVE_AI_API_KEY` | Yes | Google AI (Gemini) API key. Read automatically by `@ai-sdk/google`. |

## File structure

```
lib/ai/vercel-sdk/chat/
├── types.ts            # Types, defaults, rate limit + context config, ConversationStore contract
├── service.ts          # Internal logic (AI SDK calls, context trimming, rate limit, error normalization)
├── store.ts            # ConversationStore registry — app registers its implementation here
├── actions.ts          # Server Actions — public API for server code
├── client.ts           # Client-side streaming helper — public API for Client Components
└── stream/
    └── handler.ts      # Internal streaming logic + message persistence used by the route handler

app/api/ai/ai-sdk/chat/stream/
└── route.ts            # POST route handler for streaming
```

`client.ts` calls the route above through its private `STREAM_ENDPOINT` constant (`"/api/ai/ai-sdk/chat/stream"`). If the route is mounted at a different path, update that constant.

## Public API

Import server functions from `@/lib/ai/vercel-sdk/chat/actions`, the store registry from `@/lib/ai/vercel-sdk/chat/store`, and the client function from `@/lib/ai/vercel-sdk/chat/client`. Server Actions can also be called directly from Client Components.

| File | Export | Arguments | Returns |
|---|---|---|---|
| `store.ts` | `registerConversationStore` | `store: ConversationStore` | `void` |
| `store.ts` | `getConversationStore` | — | `ConversationStore \| null` — use it to read messages (`getMessages`) for display |
| `actions.ts` | `sendMessage` | `params: ChatCompletionParams` | `Promise<AIResult<ChatCompletionResult>>` — persists the user message and the assistant reply |
| `actions.ts` | `createConversation` | `title?: string` | `Promise<AIResult<Conversation>>` |
| `actions.ts` | `listConversations` | — | `Promise<AIResult<Conversation[]>>` |
| `actions.ts` | `getConversation` | `id: string` | `Promise<AIResult<Conversation \| null>>` |
| `actions.ts` | `renameConversation` | `id: string`, `title: string` | `Promise<AIResult<void>>` |
| `actions.ts` | `deleteConversation` | `id: string` | `Promise<AIResult<void>>` |
| `actions.ts` | `transcribeAudio` | `audio: Blob \| ArrayBuffer` | `Promise<AIResult<never>>` — always fails with `NOT_IMPLEMENTED` |
| `actions.ts` | `synthesizeSpeech` | `text: string` | `Promise<AIResult<never>>` — always fails with `NOT_IMPLEMENTED` |
| `client.ts` | `streamChat` | `params: ChatStreamParams`, `callbacks: ChatStreamCallbacks`, `signal?: AbortSignal` | `Promise<void>` — chunks and errors are delivered through `callbacks` |
| `app/api/ai/ai-sdk/chat/stream/route.ts` | `POST` | JSON body: `ChatStreamParams` (`conversationId` and `message` are required) | Success: streamed `text/plain` response. Failure: JSON `{ error: AIServiceError }` with status `400` (invalid request), `429` (rate limited), `502` (provider error) or `500` |

### Types

Imported from `@/lib/ai/vercel-sdk/chat/types`.

**`ChatCompletionParams`** / **`ChatStreamParams`**

| Field | Type | Default |
|---|---|---|
| `conversationId` | `string` | required |
| `message` | `string` — the new user message | required |
| `system` | `string?` | — |
| `temperature` | `number?` | `0.7` |
| `maxTokens` | `number?` | `1024` |
| `model` | `string?` | `"gemini-1.5-pro"` |

**`ChatCompletionResult`** — `{ message: Message; finishReason: string; usage: { promptTokens: number; completionTokens: number; totalTokens: number } }`. `message` is the assistant's reply.

**`Message`** — `{ id: string; conversationId: string; role: "user" | "assistant" | "system"; content: string; createdAt: string }` (`createdAt` is an ISO timestamp).

**`Conversation`** — `{ id: string; title: string; createdAt: string; updatedAt: string }` (ISO timestamps).

**`ChatStreamCallbacks`** (exported from `client.ts`)

| Callback | Signature | When |
|---|---|---|
| `onChunk` | `(chunk: string) => void` | For every received chunk of the assistant's reply, in order (required) |
| `onError` | `(error: AIServiceError) => void` | Once, if the request fails before or during streaming |
| `onFinish` | `() => void` | Once, when the stream completes successfully |

**`ConversationStore`** — contract implemented by the app and passed to `registerConversationStore`:

| Method | Signature |
|---|---|
| `createConversation` | `(title?: string) => Promise<Conversation>` |
| `getConversation` | `(id: string) => Promise<Conversation \| null>` |
| `listConversations` | `() => Promise<Conversation[]>` |
| `renameConversation` | `(id: string, title: string) => Promise<void>` |
| `deleteConversation` | `(id: string) => Promise<void>` |
| `addMessage` | `(message: Message) => Promise<void>` |
| `getMessages` | `(conversationId: string) => Promise<Message[]>` — return messages in chronological order |

**`AIResult<T>`** — `{ success: true; data: T } | { success: false; error: AIServiceError }`

**`AIServiceError`** — `{ code: "RATE_LIMITED" | "INVALID_REQUEST" | "PROVIDER_ERROR" | "STORE_NOT_CONFIGURED" | "NOT_IMPLEMENTED" | "UNKNOWN"; message: string; retryAfter?: number }`. `message` is safe to show in the UI; `retryAfter` (seconds) is only set for `RATE_LIMITED`.

### Behavior notes

- **Store registration:** a `ConversationStore` must be registered at app startup. Until then, every function that touches conversations or messages returns `STORE_NOT_CONFIGURED`.
- **Persistence on send:** `sendMessage` saves the user message and the assistant reply only after the model responds successfully. If the model call fails, nothing is saved.
- **Persistence on stream:** the route handler saves both messages server-side when generation finishes, independent of whether the client keeps reading. The client does not need to save anything.
- **Message history:** there is no action that lists messages. Read them through the registered store: `getConversationStore()?.getMessages(conversationId)`.
- **Context management:** only the last `CONTEXT_CONFIG.maxMessages` messages (default `20`, in `types.ts`) are sent to the model on each turn. The store may return the full history.
- **Rate limiting:** a local in-memory sliding-window limiter (`RATE_LIMIT_CONFIG` in `types.ts`, default 20 requests/minute per server instance) runs before each provider call. A provider-side `429` is normalized to the same `RATE_LIMITED` code, with `retryAfter` when the provider sends a `retry-after` header.
- **Mid-stream errors:** if the provider fails after streaming has started, the error is embedded as the final piece of streamed text. `streamChat` detects it in the last chunk and delivers it to `onError` instead of `onChunk`.
- **Voice:** `@ai-sdk/google` has no speech-to-text or text-to-speech model, so `transcribeAudio` and `synthesizeSpeech` are stubs that always return `NOT_IMPLEMENTED`.

### Reference storage schema

`ConversationStore` does not require a specific database. This is the shape it is built around:

**`conversations`**

| id | title | created_at | updated_at |
|---|---|---|---|
| `conv_1` | `Trip to Japan` | `2026-09-10T10:00:00Z` | `2026-09-10T10:00:05Z` |

**`messages`**

| id | conversation_id | role | content | created_at |
|---|---|---|---|---|
| `msg_1` | `conv_1` | `user` | `Best time to visit Kyoto?` | `2026-09-10T10:00:00Z` |
| `msg_2` | `conv_1` | `assistant` | `Spring (March–May) for cherry blossoms, or...` | `2026-09-10T10:00:05Z` |

`messages.conversation_id` references `conversations.id`; `role` is one of `user`, `assistant`, `system`.

## Examples

### Register a store (server, at startup)

```ts
import { registerConversationStore } from "@/lib/ai/vercel-sdk/chat/store";
import type { ConversationStore } from "@/lib/ai/vercel-sdk/chat/types";

const myStore: ConversationStore = {
  async createConversation(title) { /* insert into conversations */ },
  async getConversation(id) { /* select by id, or null */ },
  async listConversations() { /* select all conversations */ },
  async renameConversation(id, title) { /* update title */ },
  async deleteConversation(id) { /* delete conversation and its messages */ },
  async addMessage(message) { /* insert into messages */ },
  async getMessages(conversationId) { /* select by conversation_id, ordered by created_at */ },
};

registerConversationStore(myStore);
```

### Create a conversation and send a message (server)

```ts
import {
  createConversation,
  sendMessage,
} from "@/lib/ai/vercel-sdk/chat/actions";

const created = await createConversation("Trip to Japan");
if (!created.success) throw new Error(created.error.message);

const reply = await sendMessage({
  conversationId: created.data.id,
  message: "What's the best time to visit Kyoto?",
  system: "You are a helpful travel assistant.",
});

if (reply.success) {
  console.log(reply.data.message.content);
} else {
  console.error(reply.error.code, reply.error.message);
}
```

### Stream a reply (Client Component)

```tsx
"use client";

import { useState } from "react";
import { streamChat } from "@/lib/ai/vercel-sdk/chat/client";

export function ChatBox({ conversationId }: { conversationId: string }) {
  const [reply, setReply] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSend(message: string) {
    setReply("");
    setError(null);

    await streamChat(
      { conversationId, message },
      {
        onChunk: (chunk) => setReply((prev) => prev + chunk),
        onError: (err) => setError(err.message),
      }
    );
  }

  return (
    <div>
      <button onClick={() => handleSend("Hello!")}>Send</button>
      {error ? <p role="alert">{error}</p> : <p>{reply}</p>}
    </div>
  );
}
```

### Load a conversation's messages (server)

```ts
import { getConversationStore } from "@/lib/ai/vercel-sdk/chat/store";

const messages = (await getConversationStore()?.getMessages("conv_1")) ?? [];
```

### Manage conversations (server)

```ts
import {
  listConversations,
  renameConversation,
  deleteConversation,
} from "@/lib/ai/vercel-sdk/chat/actions";

const all = await listConversations();
await renameConversation("conv_1", "Japan itinerary");
await deleteConversation("conv_1");
```