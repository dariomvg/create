import type { ChatMessage } from "./types";
import { DEFAULT_CONTEXT_CHAR_BUDGET } from "./types";

// ============================================================================
// OpenAI Chat — Context management
// Trims older messages so the conversation fits within a character budget
// before being sent to OpenAI. This is a character-count approximation, not
// an exact token count (adding a tokenizer like tiktoken is out of scope —
// see SETUP.md).
// ============================================================================

export interface OpenAIChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * Builds the message list to send to OpenAI: an optional system prompt,
 * followed by as much recent history as fits the character budget, followed
 * by the new user message. Older messages are dropped first (oldest-out).
 */
export function buildContextMessages(params: {
  history: ChatMessage[];
  newUserMessage: string;
  systemPrompt?: string;
  charBudget?: number;
}): OpenAIChatMessage[] {
  const { history, newUserMessage, systemPrompt } = params;
  const charBudget = params.charBudget ?? DEFAULT_CONTEXT_CHAR_BUDGET;

  const systemMessage: OpenAIChatMessage[] = systemPrompt
    ? [{ role: "system", content: systemPrompt }]
    : [];

  const newMessage: OpenAIChatMessage = { role: "user", content: newUserMessage };

  // Reserve budget already used by the system prompt and the new message.
  let remainingBudget =
    charBudget - (systemPrompt?.length ?? 0) - newMessage.content.length;

  const includedHistory: OpenAIChatMessage[] = [];

  // Walk from most recent to oldest, keeping whatever fits.
  for (let i = history.length - 1; i >= 0; i--) {
    const entry = history[i];
    const cost = entry.content.length;

    if (cost > remainingBudget) break;

    includedHistory.unshift({ role: entry.role, content: entry.content });
    remainingBudget -= cost;
  }

  return [...systemMessage, ...includedHistory, newMessage];
}
