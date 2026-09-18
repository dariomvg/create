"use server";

import {
  chatCompletion,
  createConversation,
  listConversations,
  getConversationWithMessages,
  renameConversation,
  deleteConversation,
  transcribeAudio,
  toAIError,
} from "./service";
import type {
  ChatCompletionOptions,
  ChatCompletionResult,
  Conversation,
  ChatMessage,
  TranscribeAudioResult,
  AIActionResult,
} from "./types";

// ============================================================================
// OpenAI Chat — Public server actions
// Import these from Server Components / server-side form actions.
// For streaming chat or text-to-speech, use lib/openai-chat/client.ts from a
// client component instead.
// ============================================================================

/**
 * Sends a message in an existing conversation (non-streaming) and persists
 * both the user message and the assistant reply.
 * Never throws — check `result.ok`.
 */
export async function sendMessageAction(
  options: ChatCompletionOptions
): Promise<AIActionResult<ChatCompletionResult>> {
  try {
    const data = await chatCompletion(options);
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: toAIError(err) };
  }
}

/** Creates a new conversation. */
export async function createConversationAction(
  title?: string
): Promise<AIActionResult<Conversation>> {
  try {
    const data = await createConversation(title);
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: toAIError(err) };
  }
}

/** Lists all conversations, most recently updated first. */
export async function listConversationsAction(): Promise<
  AIActionResult<Conversation[]>
> {
  try {
    const data = await listConversations();
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: toAIError(err) };
  }
}

/** Fetches a conversation along with its full message history. */
export async function getConversationAction(
  conversationId: string
): Promise<AIActionResult<{ conversation: Conversation; messages: ChatMessage[] }>> {
  try {
    const data = await getConversationWithMessages(conversationId);
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: toAIError(err) };
  }
}

/** Renames an existing conversation. */
export async function renameConversationAction(
  conversationId: string,
  title: string
): Promise<AIActionResult<Conversation>> {
  try {
    const data = await renameConversation(conversationId, title);
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: toAIError(err) };
  }
}

/** Deletes a conversation and its message history. */
export async function deleteConversationAction(
  conversationId: string
): Promise<AIActionResult<void>> {
  try {
    await deleteConversation(conversationId);
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: toAIError(err) };
  }
}

/**
 * Transcribes an audio recording to text (speech-to-text).
 * Expects a FormData with an "audio" File entry and an optional "language"
 * field (ISO-639-1 code).
 */
export async function transcribeAudioAction(
  formData: FormData
): Promise<AIActionResult<TranscribeAudioResult>> {
  try {
    const file = formData.get("audio");
    if (!(file instanceof File)) {
      return {
        ok: false,
        error: {
          code: "INVALID_REQUEST",
          message: "No audio file provided.",
          retryable: false,
        },
      };
    }

    const language = formData.get("language");

    const data = await transcribeAudio({
      file,
      language: typeof language === "string" ? language : undefined,
    });

    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: toAIError(err) };
  }
}
