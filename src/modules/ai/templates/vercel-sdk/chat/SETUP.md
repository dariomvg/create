# Vercel AI SDK — Chat Module

A self-contained module for chat using the [Vercel AI SDK](https://sdk.vercel.ai) with **Google (Gemini)** as the provider. Covers chat completion, streaming chat, conversation/message history, multiple conversations, conversation management, and context management. Speech-to-text and text-to-speech are exposed as stubs (see "Voice" below).

Standalone — does not depend on the `vercel-ai-sdk-text-generation` module.

## Dependencies

- `ai` — the Vercel AI SDK core (`generateText`, `streamText`, `APICallError`)
- `@ai-sdk/google` — the Google (Gemini) provider adapter

## File structure

```
types.ts              Shared types, defaults, rate limit + context config, ConversationStore contract
service.ts              Internal logic: calls the AI SDK, trims context, normalizes errors — do not modify
store.ts                Conversation store registry — register your own persistence here
actions.ts               Server Actions — import into Server Components
client.ts                 Client-side streaming helper — import into Client Components
stream/handler.ts    Internal streaming logic + message persistence, used by the route handler
stream/route.ts         Route handler — copy to app/api/ai-sdk/chat/stream/route.ts
.env.local                Environment variable for the Google API key
```

## Setup

1. **Implement and register a `ConversationStore`.** This module has no database of its own — persistence is entirely up to you. Implement the interface from `types.ts` and register it once, at app startup (e.g. in a server-only module that runs early):

   ```ts
   import { registerConversationStore } from "@/lib/ai-chat/store";
   import type { ConversationStore } from "@/lib/ai-chat/types";

   const myStore: ConversationStore = {
     async createConversation(title) { /* ... */ },
     async getConversation(id) { /* ... */ },
     async listConversations() { /* ... */ },
     async renameConversation(id, title) { /* ... */ },
     async deleteConversation(id) { /* ... */ },
     async addMessage(message) { /* ... */ },
     async getMessages(conversationId) { /* ... */ },
   };

   registerConversationStore(myStore);
   ```

   Until this is registered, every action that touches conversations or messages returns a `STORE_NOT_CONFIGURED` error instead of crashing.

2. Copy `stream/route.ts` into your project at:
   ```
   app/api/ai-sdk/chat/stream/route.ts
   ```
   (keep `stream/handler.ts` alongside it, since the route imports it by relative path)

3. Add your Google AI API key to `.env.local`. Get one at https://aistudio.google.com/apikey

### Example storage schema

`ConversationStore` doesn't require any specific database, but here's the shape it's built around — two tables, matching `Conversation` and `Message` from `types.ts`. Use this as a starting point when implementing the interface with Supabase, Prisma, or anything else.

**`conversations`**

| column       | type      | notes                  |
|--------------|-----------|-------------------------|
| `id`         | text/uuid | primary key             |
| `title`      | text      |                          |
| `created_at` | timestamp |                          |
| `updated_at` | timestamp | bump on new message      |

**`messages`**

| column             | type      | notes                          |
|--------------------|-----------|----------------------------------|
| `id`               | text/uuid | primary key                     |
| `conversation_id`  | text/uuid | foreign key → `conversations.id` |
| `role`             | text      | `user` \| `assistant` \| `system` |
| `content`          | text      |                                  |
| `created_at`       | timestamp |                                  |

Example rows, for a conversation with one exchange:

**`conversations`**

| id      | title              | created_at            | updated_at            |
|---------|--------------------|------------------------|------------------------|
| `conv_1`| "Trip to Japan"     | 2026-09-10T10:00:00Z  | 2026-09-10T10:00:05Z  |

**`messages`**

| id      | conversation_id | role        | content                          | created_at            |
|---------|------------------|-------------|-----------------------------------|------------------------|
| `msg_1` | `conv_1`         | `user`      | "Best time to visit Kyoto?"      | 2026-09-10T10:00:00Z  |
| `msg_2` | `conv_1`         | `assistant` | "Spring (March–May) for cherry blossoms, or..." | 2026-09-10T10:00:05Z  |

`getMessages(conversationId)` should return all rows for that `conversation_id`, in chronological order — `service.ts` handles trimming them down to `CONTEXT_CONFIG.maxMessages` before calling the model, so you don't need to paginate or limit the query for that reason.

## Usage

### Manage conversations (server)

```ts
import { createConversation, listConversations } from "@/lib/ai-chat/actions";

const created = await createConversation("Trip to Japan");
if (created.success) {
  console.log(created.data.id);
}

const all = await listConversations();
```

### Send a message, no streaming (server)

```ts
import { sendMessage } from "@/lib/ai-chat/actions";

const result = await sendMessage({
  conversationId: "conv_1",
  message: "What's the best time to visit Kyoto?",
  system: "You are a helpful travel assistant.",
});

if (result.success) {
  console.log(result.data.message.content);
} else {
  console.error(result.error.message);
}
```

### Stream a message (client)

```tsx
"use client";

import { useState } from "react";
import { streamChat } from "@/lib/ai-chat/client";

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
      {error ? <p role="alert">{error}</p> : <p>{reply}</p>}
    </div>
  );
}
```

Both the user's message and the assistant's full reply are saved to the `ConversationStore` automatically once the stream finishes — no separate save call is needed from the client.

## Voice (not implemented)

`transcribeAudio` and `synthesizeSpeech` in `actions.ts` are stubs that always return a `NOT_IMPLEMENTED` error. `@ai-sdk/google` has no speech-to-text or text-to-speech model — Google's voice models are only reachable through the AI SDK via **AI Gateway** (`@ai-sdk/gateway`, a separate package and API key), or by switching those two functions to a different provider (e.g. OpenAI's Whisper + TTS). Implement one of those directly in `actions.ts` if you need this.

## Error handling

Same normalized shape as the text-generation module:

```ts
{
  code: "RATE_LIMITED" | "INVALID_REQUEST" | "PROVIDER_ERROR" | "STORE_NOT_CONFIGURED" | "NOT_IMPLEMENTED" | "UNKNOWN",
  message: string,       // safe to show in the UI
  retryAfter?: number,   // seconds, only present for RATE_LIMITED
}
```

## Rate limiting

Same two-layer approach as the text-generation module: a local in-memory sliding-window limiter (`RATE_LIMIT_CONFIG` in `types.ts`, default 20 requests/minute per server instance) plus normalized handling of the provider's own 429 responses.

## Context management

`CONTEXT_CONFIG.maxMessages` in `types.ts` (default 20) caps how many prior messages are sent to the model on each turn. It's a simple message-count limit, not a token counter — adjust the number directly if your conversations run long and you hit the model's context window, or swap in a token-based strategy in `service.ts`'s `trimContext` if you need more precision.

## Known limitation

Mid-stream provider errors are embedded as the final piece of streamed text, the same simplification as in the text-generation module — see that module's SETUP.md for details.
