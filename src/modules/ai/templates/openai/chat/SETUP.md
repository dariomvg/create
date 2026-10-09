# OpenAI Chat

Chat with the OpenAI SDK for Next.js (App Router): chat completion and streaming chat over persistent conversations, multiple conversations with management (create, list, rename, delete), message history stored through a swappable store, automatic context trimming, speech-to-text and text-to-speech.

## Dependencies

- `openai`
- `server-only`

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `OPENAI_API_KEY` | Yes | OpenAI API key. Read on the server only. |

## File structure

```
lib/ai/openai/chat/
├── actions.ts        # "use server" — public API (chat, conversations, speech-to-text)
├── client.ts         # Public API for Client Components (streaming chat, text-to-speech)
├── service.ts        # Internal — SDK calls, store/context orchestration, error normalization. Never import directly.
├── store.ts          # ChatHistoryStore contract + in-memory implementation (replace with your database)
├── context.ts        # Internal — trims history to a character budget before each request
├── types.ts          # Types, defaults (models, tokens, voice, context budget) and rate limit config
├── stream/
│   └── handler.ts    # Internal — builds the chat ReadableStream. Used only by the stream route.
└── audio/
    └── handler.ts    # Internal — builds the speech ReadableStream. Used only by the speech route.

app/api/openai-chat/stream/route.ts   # POST route handler (streaming chat)
app/api/openai-chat/speech/route.ts   # POST route handler (text-to-speech)
```

`client.ts` calls `/api/openai-chat/stream` (`CHAT_STREAM_ENDPOINT`) and `/api/openai-chat/speech` (`SPEECH_ENDPOINT`). Keep both constants in sync with the routes' locations.

## Public API

### `actions.ts` — `@/lib/ai/openai/chat/actions`

Server-side (also callable from Client Components as Server Actions). Never throw: always check `result.ok`.

| Export | Arguments | Returns |
|---|---|---|
| `sendMessageAction` | `options: ChatCompletionOptions` | `Promise<AIActionResult<ChatCompletionResult>>` — persists the user message and the assistant reply |
| `createConversationAction` | `title?: string` (default `"New conversation"`) | `Promise<AIActionResult<Conversation>>` |
| `listConversationsAction` | none | `Promise<AIActionResult<Conversation[]>>` — most recently updated first |
| `getConversationAction` | `conversationId: string` | `Promise<AIActionResult<{ conversation: Conversation; messages: ChatMessage[] }>>` — `NOT_FOUND` if the id does not exist |
| `renameConversationAction` | `conversationId: string`, `title: string` | `Promise<AIActionResult<Conversation>>` — `NOT_FOUND` if the id does not exist |
| `deleteConversationAction` | `conversationId: string` | `Promise<AIActionResult<void>>` |
| `transcribeAudioAction` | `formData: FormData` — field `audio` (`File`, required), field `language` (ISO-639-1 string, optional) | `Promise<AIActionResult<TranscribeAudioResult>>` — `INVALID_REQUEST` if `audio` is missing |

### `client.ts` — `@/lib/ai/openai/chat/client`

Browser-side. Throws an `AIActionError` on failure (use `try/catch`).

| Export | Arguments | Returns |
|---|---|---|
| `streamChatMessage` | `options: ChatCompletionOptions` | `AsyncGenerator<string>` — yields the assistant reply in chunks; the full exchange is persisted when the stream completes |
| `textToSpeech` | `options: SynthesizeSpeechOptions` | `Promise<Blob>` — mp3 audio, ready for `new Audio(URL.createObjectURL(blob))` |

### Route handlers

| Route | Export | Arguments | Returns |
|---|---|---|---|
| `app/api/openai-chat/stream/route.ts` | `POST` | JSON body: `ChatCompletionOptions` | `200` with a `text/plain` stream of reply chunks. On failure, JSON `{ error: AIActionError }` with status `429` (`RATE_LIMITED`), `401` (`AUTH_ERROR`), `400` (`INVALID_REQUEST`), `404` (`NOT_FOUND`), `504` (`TIMEOUT`) or `500`. |
| `app/api/openai-chat/speech/route.ts` | `POST` | JSON body: `SynthesizeSpeechOptions` | `200` with an `audio/mpeg` stream. On failure, JSON `{ error: AIActionError }` with status `429`, `401`, `400`, `504` or `500`. |

### `store.ts` — `@/lib/ai/openai/chat/store`

Persistence contract used by the service. The shipped implementation is in-memory.

| Export | Arguments | Returns |
|---|---|---|
| `getChatStore` | none | `ChatHistoryStore` — singleton accessor. Return your database-backed implementation here. |
| `ConversationNotFoundError` | `conversationId: string` (class) | Custom `Error`. Store implementations must throw it when an id does not exist so it maps to `NOT_FOUND`. |

`ChatHistoryStore` methods:

| Method | Arguments | Returns |
|---|---|---|
| `createConversation` | `title?: string` | `Promise<Conversation>` |
| `getConversation` | `id: string` | `Promise<Conversation \| null>` |
| `listConversations` | none | `Promise<Conversation[]>` |
| `renameConversation` | `id: string`, `title: string` | `Promise<Conversation>` — throws `ConversationNotFoundError` |
| `deleteConversation` | `id: string` | `Promise<void>` — also removes its messages |
| `addMessage` | `conversationId: string`, `message: { role, content }` | `Promise<ChatMessage>` — must set `id`/`createdAt`, bump the conversation's `updatedAt`, throw `ConversationNotFoundError` |
| `getMessages` | `conversationId: string` | `Promise<ChatMessage[]>` — chronological order |

### Types — `@/lib/ai/openai/chat/types`

```ts
type ChatRole = "system" | "user" | "assistant";

interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string; // ISO date
}

interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

interface ChatCompletionOptions {
  conversationId: string;   // must already exist
  message: string;          // new user message; earlier history is loaded from the store
  systemPrompt?: string;    // not stored — send it on every call
  model?: string;           // default "gpt-4o-mini"
  temperature?: number;     // default 0.7
  maxOutputTokens?: number; // default 1024, capped at 4096
}

interface ChatCompletionResult {
  message: ChatMessage;     // the persisted assistant message
  model: string;
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
}

interface TranscribeAudioResult {
  text: string;
}

interface SynthesizeSpeechOptions {
  text: string;
  model?: string; // default "tts-1"
  voice?: string; // default "alloy"
}

type AIActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: AIActionError };

interface AIActionError {
  code: "RATE_LIMITED" | "INVALID_REQUEST" | "AUTH_ERROR" | "TIMEOUT" | "NOT_FOUND" | "UNKNOWN";
  message: string;      // safe to show in the UI
  retryable: boolean;
  retryAfter?: number;  // seconds — only set for RATE_LIMITED
}
```

Speech-to-text uses `whisper-1` by default.

### Behavior

- **History and context:** only the new `message` is sent per call; history comes from the store. Before each request, the oldest messages are dropped until the history fits about 12,000 characters (a character approximation, not an exact token count). The stored history is not modified.
- **Persistence:** `sendMessageAction` saves the user message and the assistant reply only after OpenAI answers successfully. With streaming, the user message is saved when the stream starts and the assistant reply only once the stream completes. If the stream fails midway, the partial reply is not saved, so the history can end with a user message that has no reply.
- **In-memory store:** conversations are lost on every server restart and are not shared across instances. Implement `ChatHistoryStore` against your database and return it from `getChatStore()` before deploying.
- **Ownership:** conversations are not tied to a user. Anyone who knows a `conversationId` can read or write it, so add your own ownership checks around the actions.
- **Rate limit:** `sendMessageAction` and `transcribeAudioAction` retry a 429 up to 2 times with exponential backoff. If retries run out, the result is `RATE_LIMITED` with `retryAfter` in seconds (20 by default). `streamChatMessage` and `textToSpeech` do not retry: a 429 is thrown immediately.
- **Failure after the stream has started:** the connection is closed and no JSON error can be sent. Treat a truncated stream as a failed request in the UI.
- **Audio uploads:** `transcribeAudioAction` receives the file as a Server Action, so raise `serverActions.bodySizeLimit` in `next.config` if recordings can exceed the default 1 MB. OpenAI accepts audio files up to 25 MB.

## Examples

### Create a conversation and send a message (server)

```ts
import {
  createConversationAction,
  sendMessageAction,
} from "@/lib/ai/openai/chat/actions";

const created = await createConversationAction("Trip planning");
if (!created.ok) throw new Error(created.error.message);

const reply = await sendMessageAction({
  conversationId: created.data.id,
  message: "What's a good 3-day itinerary for Lisbon?",
  systemPrompt: "You are a helpful travel assistant.",
});

if (reply.ok) {
  console.log(reply.data.message.content);
} else if (reply.error.code === "RATE_LIMITED") {
  console.log(`Retry in ${reply.error.retryAfter}s`);
}
```

### Load a conversation with its history (server)

```ts
import { getConversationAction } from "@/lib/ai/openai/chat/actions";

const result = await getConversationAction(conversationId);

if (result.ok) {
  const { conversation, messages } = result.data;
  // render conversation.title and messages
} else if (result.error.code === "NOT_FOUND") {
  // conversation does not exist
}
```

### Streaming chat (client)

```tsx
"use client";

import { useState } from "react";
import { streamChatMessage } from "@/lib/ai/openai/chat/client";
import type { AIActionError } from "@/lib/ai/openai/chat/types";

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

### Speech-to-text (client)

```tsx
"use client";

import { transcribeAudioAction } from "@/lib/ai/openai/chat/actions";

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

### Text-to-speech (client)

```tsx
"use client";

import { textToSpeech } from "@/lib/ai/openai/chat/client";

async function handlePlay(text: string) {
  try {
    const blob = await textToSpeech({ text, voice: "alloy" });
    new Audio(URL.createObjectURL(blob)).play();
  } catch (err) {
    console.error((err as { message: string }).message);
  }
}
```