"use server";

/**
 * Server Actions for the Vercel AI SDK Chat module.
 * Import these directly into Server Components or other server-side code.
 *
 * Requires a ConversationStore to be registered via store.ts's
 * registerConversationStore() during app startup — otherwise every
 * function here returns a STORE_NOT_CONFIGURED error.
 *
 * Streaming is not exposed here — Server Actions can't return a native
 * ReadableStream. Use the route handler in stream/route.ts (via client.ts
 * on the client side) for streaming instead.
 */

import { generateChatCompletionService } from "./service";
import { requireConversationStore } from "./store";
import type {
  ChatCompletionParams,
  ChatCompletionResult,
  Conversation,
  Message,
  AIResult,
} from "./types";

// ---------------------------------------------------------------------------
// Chat completion
// ---------------------------------------------------------------------------

/**
 * Sends a new user message in a conversation, gets the assistant's reply,
 * and persists both messages via the registered ConversationStore.
 */
export async function sendMessage(
  params: ChatCompletionParams
): Promise<AIResult<ChatCompletionResult>> {
  const storeResult = requireConversationStore();
  if (!storeResult.success) return storeResult;
  const store = storeResult.data;

  const history = await store.getMessages(params.conversationId);

  const modelResult = await generateChatCompletionService({
    history,
    newMessage: params.message,
    system: params.system,
    temperature: params.temperature,
    maxTokens: params.maxTokens,
    model: params.model,
  });

  if (!modelResult.success) return modelResult;

  const userMessage: Message = {
    id: crypto.randomUUID(),
    conversationId: params.conversationId,
    role: "user",
    content: params.message,
    createdAt: new Date().toISOString(),
  };

  const assistantMessage: Message = {
    id: crypto.randomUUID(),
    conversationId: params.conversationId,
    role: "assistant",
    content: modelResult.data.text,
    createdAt: new Date().toISOString(),
  };

  await store.addMessage(userMessage);
  await store.addMessage(assistantMessage);

  return {
    success: true,
    data: {
      message: assistantMessage,
      finishReason: modelResult.data.finishReason,
      usage: modelResult.data.usage,
    },
  };
}

// ---------------------------------------------------------------------------
// Conversation management
// ---------------------------------------------------------------------------

export async function createConversation(
  title?: string
): Promise<AIResult<Conversation>> {
  const storeResult = requireConversationStore();
  if (!storeResult.success) return storeResult;

  try {
    const conversation = await storeResult.data.createConversation(title);
    return { success: true, data: conversation };
  } catch {
    return {
      success: false,
      error: { code: "UNKNOWN", message: "Could not create the conversation." },
    };
  }
}

export async function listConversations(): Promise<AIResult<Conversation[]>> {
  const storeResult = requireConversationStore();
  if (!storeResult.success) return storeResult;

  try {
    const conversations = await storeResult.data.listConversations();
    return { success: true, data: conversations };
  } catch {
    return {
      success: false,
      error: { code: "UNKNOWN", message: "Could not load conversations." },
    };
  }
}

export async function getConversation(
  id: string
): Promise<AIResult<Conversation | null>> {
  const storeResult = requireConversationStore();
  if (!storeResult.success) return storeResult;

  try {
    const conversation = await storeResult.data.getConversation(id);
    return { success: true, data: conversation };
  } catch {
    return {
      success: false,
      error: { code: "UNKNOWN", message: "Could not load the conversation." },
    };
  }
}

export async function renameConversation(
  id: string,
  title: string
): Promise<AIResult<void>> {
  const storeResult = requireConversationStore();
  if (!storeResult.success) return storeResult;

  try {
    await storeResult.data.renameConversation(id, title);
    return { success: true, data: undefined };
  } catch {
    return {
      success: false,
      error: { code: "UNKNOWN", message: "Could not rename the conversation." },
    };
  }
}

export async function deleteConversation(id: string): Promise<AIResult<void>> {
  const storeResult = requireConversationStore();
  if (!storeResult.success) return storeResult;

  try {
    await storeResult.data.deleteConversation(id);
    return { success: true, data: undefined };
  } catch {
    return {
      success: false,
      error: { code: "UNKNOWN", message: "Could not delete the conversation." },
    };
  }
}

// ---------------------------------------------------------------------------
// Voice (stubs — not implemented)
// ---------------------------------------------------------------------------

/**
 * Speech-to-text is not implemented in this module: @ai-sdk/google has no
 * transcription model. See SETUP.md for how to connect one (AI Gateway or
 * a different provider) if you need this.
 */
export async function transcribeAudio(
  _audio: Blob | ArrayBuffer
): Promise<AIResult<never>> {
  return {
    success: false,
    error: {
      code: "NOT_IMPLEMENTED",
      message: "Speech-to-text is not implemented in this module.",
    },
  };
}

/**
 * Text-to-speech is not implemented in this module: @ai-sdk/google has no
 * speech model. See SETUP.md for how to connect one (AI Gateway or a
 * different provider) if you need this.
 */
export async function synthesizeSpeech(
  _text: string
): Promise<AIResult<never>> {
  return {
    success: false,
    error: {
      code: "NOT_IMPLEMENTED",
      message: "Text-to-speech is not implemented in this module.",
    },
  };
}
