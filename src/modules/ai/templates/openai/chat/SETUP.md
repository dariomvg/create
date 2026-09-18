# OpenAI Chat — Setup

Drop-in chat module for Next.js (App Router) using the OpenAI SDK. Covers
chat completion, streaming chat, persistent conversations with message
history, context management, speech-to-text and text-to-speech.

This is a **separate, independent module** from the OpenAI Text Generation
module — it doesn't import from or depend on it in any way.

## Dependencies

- `openai` — official OpenAI SDK

## Environment variables

See `.env.local`:

- `OPENAI_API_KEY` — required.

## File structure

```
lib/openai-chat/
├── types.ts                # Types, default model/token config, rate limit config
├── store.ts                  # ChatHistoryStore interface + in-memory reference implementation
├── context.ts                # Trims message history to fit a character budget before calling OpenAI
├── service.ts                # Internal logic (SDK calls, store/context orchestration, error normalization)
├── actions.ts                 # "use server" — public API for Server Components
├── client.ts                   # Public API for Client Components (streaming chat, text-to-speech)
├── stream/
│   ├── handler.ts             # Internal — builds the chat ReadableStream
│   └── route.ts                 # Copy to app/api/openai-chat/stream/route.ts
├── audio/
│   ├── handler.ts             # Internal — builds the speech ReadableStream
│   └── route.ts                 # Copy to app/api/openai-chat/speech/route.ts
└── .env.local
```

## ⚠️ Before deploying: replace the in-memory store

`store.ts` ships with `createInMemoryChatStore()` for local development only.
Conversations and messages are lost on every server restart and aren't
shared across serverless instances. Implement the `ChatHistoryStore`
interface against your own database and swap it in `getChatStore()` — no
other file needs to change.

## Setup steps

1. Copy the `lib/openai-chat/` folder into your project.
2. Copy `lib/openai-chat/stream/route.ts` to `app/api/openai-chat/stream/route.ts`.
3. Copy `lib/openai-chat/audio/route.ts` to `app/api/openai-chat/speech/route.ts`.
4. Set `OPENAI_API_KEY` in your project's `.env.local`.
5. Before going to production, replace the in-memory store (see above).

## Usage

### Conversation management (Server Component / server action)

```ts
import {
  createConversationAction,
  listConversationsAction,
  getConversationAction,
  renameConversationAction,
  deleteConversationAction,
} from "@/lib/openai-chat/actions";

const created = await createConversationAction("Trip planning");
if (created.ok) {
  const conversationId = created.data.id;
}

const list = await listConversationsAction();
if (list.ok) {
  console.log(list.data); // Conversation[]
}

const details = await getConversationAction(conversationId);
if (details.ok) {
  console.log(details.data.conversation, details.data.messages);
}
```

### Sending a message (non-streaming)

```ts
import { sendMessageAction } from "@/lib/openai-chat/actions";

const result = await sendMessageAction({
  conversationId,
  message: "What's a good 3-day itinerary for Lisbon?",
  systemPrompt: "You are a helpful travel assistant.",
});

if (result.ok) {
  console.log(result.data.message.content);
} else {
  console.error(result.error.message);
}
```

### Streaming a reply (Client Component)

```tsx
"use client";

import { useState } from "react";
import { streamChatMessage } from "@/lib/openai-chat/client";
import type { AIActionError } from "@/lib/openai-chat/types";

export function ChatBox({ conversationId }: { conversationId: string }) {
  const [reply, setReply] = useState("");
  const [error, setError] = useState<AIActionError | null>(null);

  async function handleSend(message: string) {
    setReply("");
    setError(null);

    try {
      for await (const chunk of streamChatMessage({ conversationId, message })) {
        setReply((prev) => prev + chunk);
      }
    } catch (err) {
      setError(err as AIActionError);
    }
  }

  return (
    <div>
      {error && <p>{error.message}</p>}
      <p>{reply}</p>
    </div>
  );
}
```

### Speech-to-text (Client Component → Server Action)

```tsx
"use client";

import { transcribeAudioAction } from "@/lib/openai-chat/actions";

async function handleRecordingStop(blob: Blob) {
  const formData = new FormData();
  formData.set("audio", blob, "recording.webm");
  formData.set("language", "en");

  const result = await transcribeAudioAction(formData);
  if (result.ok) {
    console.log(result.data.text);
  }
}
```

### Text-to-speech (Client Component)

```tsx
"use client";

import { textToSpeech } from "@/lib/openai-chat/client";

async function handlePlay(text: string) {
  const blob = await textToSpeech({ text });
  const audio = new Audio(URL.createObjectURL(blob));
  audio.play();
}
```

## Error handling

Same normalized shape across the whole module:

```ts
interface AIActionError {
  code: "RATE_LIMITED" | "INVALID_REQUEST" | "AUTH_ERROR" | "TIMEOUT" | "NOT_FOUND" | "UNKNOWN";
  message: string;
  retryable: boolean;
  retryAfter?: number; // seconds, only set for RATE_LIMITED
}
```

- `actions.ts` functions never throw — they return `{ ok: false, error }`.
- `client.ts`'s `streamChatMessage` and `textToSpeech` throw the
  `AIActionError` — use try/catch.
- `NOT_FOUND` is returned when a `conversationId` doesn't exist in the store.

## Rate limiting

Same approach as the Text Generation module: `chatCompletion` and
`transcribeAudio` auto-retry on a 429 with exponential backoff (see
`RATE_LIMIT_CONFIG` in `types.ts`). `streamChatCompletion` and
`synthesizeSpeech` don't auto-retry — a 429 surfaces immediately as
`RATE_LIMITED` with a `retryAfter` in seconds.

## Context management

`context.ts` trims older messages so the conversation fits within
`DEFAULT_CONTEXT_CHAR_BUDGET` characters before each request. This is a
character-count approximation, not an exact token count — adding a real
tokenizer (e.g. `tiktoken`) was left out to keep the module dependency-free.
If you need exact token budgeting, swap the logic in `context.ts`.

## Known limitations

- **In-memory store**: see the warning above — replace before deploying.
- **Mid-stream failures**: if a chat stream fails after it starts, the
  connection is simply closed and the partial reply is **not** saved to
  history (an incomplete assistant message could confuse the next turn).
  Treat an unexpectedly short stream as a soft failure in the UI.
- **Context trimming**: character-based, not exact tokens — see above.
