# Anthropic Chat — Setup

Drop-in chat module for Next.js App Router using the Anthropic API. Separate and independent from the Text Generation module — use this one when you need conversations with history, not single-shot generations.

## What's included

- Chat completion (non-streaming)
- Streaming chat
- Conversation + message history
- Persistent chat history (via a swappable store)
- Multiple conversations
- Conversation management (create, rename, delete, list)
- Context management (automatic trimming of old messages using the real token-counting endpoint)

Not included by design: speech-to-text and text-to-speech — the Anthropic API doesn't offer these natively. If you need voice, integrate a separate provider (e.g. Whisper, ElevenLabs) and feed the resulting text into `sendMessage` / `streamMessage`.

## Dependencies

This module uses:

- [`@anthropic-ai/sdk`](https://www.npmjs.com/package/@anthropic-ai/sdk)

Not installed automatically — add it to your project's `package.json` as you normally would.

## File map

| File | Runs on | What it's for |
|---|---|---|
| `types.ts` | both | Shared types, defaults, error shapes |
| `store.ts` | server | Persistence contract (`ChatStore`) + default in-memory implementation |
| `service.ts` | server | Internal Anthropic SDK calls, context management, error normalization |
| `actions.ts` | server | Server Actions — import into server components |
| `client.ts` | client | Client-side streaming — import into client components |
| `stream/handler.ts` | server | Internal streaming request handler |
| `stream/route.ts` | server | Copy to `app/api/anthropic/chat/stream/route.ts` |
| `.env.local` | — | Environment variables |

## Setup

1. Copy all files into your project (suggested location: `lib/ai/anthropic/chat/`).
2. Copy `stream/route.ts` to `app/api/anthropic/chat/stream/route.ts`, alongside a copy of `stream/handler.ts` (or keep `handler.ts` in your lib folder and import it from there — just update the relative import in `route.ts`).
3. Add your key to `.env.local`:
   ```
   ANTHROPIC_API_KEY=sk-ant-...
   ```
4. Make sure `@anthropic-ai/sdk` is in your dependencies.
5. (Optional) The module works out of the box with an in-memory store, which is lost on restart and not shared across server instances. For production, implement `ChatStore` (defined in `store.ts`) against your own database and register it once at startup:
   ```ts
   import { setChatStore } from "@/lib/ai/anthropic/chat/store";
   import { PostgresChatStore } from "./postgres-chat-store";

   setChatStore(new PostgresChatStore(db));
   ```

## Usage

### Create a conversation and send a message (server component / server action)

```ts
import { createConversation, sendMessage } from "@/lib/ai/anthropic/chat/actions";

const conversation = await createConversation("Trip planning");

const result = await sendMessage(conversation.id, "Suggest a 5-day itinerary for Japan", {
  systemPrompt: "You are a helpful travel assistant.",
});

if (result.error) {
  // result.error.code, result.error.message
} else {
  console.log(result.data.message.content);
}
```

### List and manage conversations (server component / server action)

```ts
import {
  listConversations,
  getConversation,
  renameConversation,
  deleteConversation,
} from "@/lib/ai/anthropic/chat/actions";

const conversations = await listConversations();
const full = await getConversation(conversations[0].id); // includes messages
await renameConversation(conversations[0].id, "Japan trip");
await deleteConversation(conversations[0].id);
```

### Streaming chat (client component)

```tsx
"use client";

import { useState } from "react";
import { streamMessage } from "@/lib/ai/anthropic/chat/client";

export function ChatWindow({ conversationId }: { conversationId: string }) {
  const [reply, setReply] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleSend(content: string) {
    setReply("");
    setError(null);
    setIsStreaming(true);

    streamMessage(conversationId, content, undefined, {
      onChunk: (text) => setReply((prev) => prev + text),
      onError: (err) => setError(err.message),
      onDone: () => setIsStreaming(false),
    });
  }

  return (
    <div>
      <p>{reply}</p>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
```

## Error handling

Same normalized shape as the Text Generation module, plus `"not_found"` for operations on a conversation that doesn't exist:

```ts
type AIErrorCode =
  | "invalid_request"
  | "authentication_error"
  | "rate_limited"
  | "overloaded"
  | "network_error"
  | "not_found"
  | "unknown_error";

interface AIError {
  code: AIErrorCode;
  message: string;
  retryAfter?: number; // present when code === "rate_limited"
}
```

## Context management

Each request checks the conversation's token count via `anthropic.messages.countTokens()` and trims the oldest messages until it fits within `DEFAULT_MAX_CONTEXT_TOKENS` (150,000, overridable per call via `options.maxContextTokens`). Trimming only affects what's sent to the model — the full history stays persisted in your store.
