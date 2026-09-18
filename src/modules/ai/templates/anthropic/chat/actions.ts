"use server";

/**
 * Server Actions for the Anthropic Chat module.
 *
 * These are the functions meant to be imported directly into server
 * components. Streaming is not available here — use client.ts + the
 * /chat/stream route for streaming from client components.
 */

import { chatCompletionService } from "./service";
import { getChatStore } from "./store";
import type {
  AIResult,
  ChatCompletionResult,
  Conversation,
  ConversationWithMessages,
  GenerationOptions,
} from "./types";

/**
 * Sends a message in an existing conversation and returns the assistant's
 * reply. The user message and the assistant's response are both persisted.
 *
 * @example
 * const result = await sendMessage(conversationId, "What's the weather like on Mars?");
 * if (!result.error) console.log(result.data.message.content);
 */
export async function sendMessage(
  conversationId: string,
  content: string,
  options?: GenerationOptions
): Promise<AIResult<ChatCompletionResult>> {
  return chatCompletionService(conversationId, content, options);
}

/**
 * Creates a new conversation.
 *
 * @example
 * const conversation = await createConversation("Trip planning");
 */
export async function createConversation(title?: string): Promise<Conversation> {
  return getChatStore().createConversation(title);
}

/**
 * Fetches a single conversation along with its full message history.
 * Returns null if the conversation doesn't exist.
 */
export async function getConversation(
  conversationId: string
): Promise<ConversationWithMessages | null> {
  return getChatStore().getConversation(conversationId);
}

/** Lists all conversations, most recently updated first. */
export async function listConversations(): Promise<Conversation[]> {
  return getChatStore().listConversations();
}

/** Renames a conversation. */
export async function renameConversation(
  conversationId: string,
  title: string
): Promise<void> {
  return getChatStore().updateConversationTitle(conversationId, title);
}

/** Deletes a conversation and its message history. */
export async function deleteConversation(conversationId: string): Promise<void> {
  return getChatStore().deleteConversation(conversationId);
}
