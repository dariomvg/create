/**
 * Conversation persistence registry for the Vercel AI SDK Chat module.
 *
 * This module ships no database implementation. Implement the
 * ConversationStore interface (see types.ts) backed by whatever you use
 * (Supabase, Prisma, etc.) and register it once during app startup:
 *
 *   import { registerConversationStore } from "@/lib/ai-chat/store";
 *   registerConversationStore(mySupabaseConversationStore);
 *
 * actions.ts reads the registered store through requireConversationStore()
 * and returns a clear error if none was registered, instead of throwing.
 */

import type { AIResult, ConversationStore } from "./types";

let currentStore: ConversationStore | null = null;

/** Registers the active ConversationStore implementation. Call once at startup. */
export function registerConversationStore(store: ConversationStore): void {
  currentStore = store;
}

/** Returns the registered store, or null if none has been registered yet. */
export function getConversationStore(): ConversationStore | null {
  return currentStore;
}

/**
 * Returns the registered store as an AIResult, so callers get a normalized
 * STORE_NOT_CONFIGURED error instead of a null-reference crash.
 */
export function requireConversationStore(): AIResult<ConversationStore> {
  if (!currentStore) {
    return {
      success: false,
      error: {
        code: "STORE_NOT_CONFIGURED",
        message:
          "No conversation store has been registered. Call registerConversationStore() during app startup.",
      },
    };
  }

  return { success: true, data: currentStore };
}
