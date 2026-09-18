/**
 * Persistence layer for chat conversations.
 *
 * This module ships a working in-memory implementation so the chat module
 * runs out of the box, but in-memory storage is lost on server restart and
 * is NOT shared across server instances.
 *
 * For production, implement ChatStore against your own database (Postgres,
 * Redis, etc.) and swap it in via setChatStore() — every other file in this
 * module (service.ts, actions.ts) only depends on the ChatStore interface,
 * never on this in-memory implementation directly.
 */

import type { ChatMessage, Conversation, ConversationWithMessages } from "./types";

// ---------------------------------------------------------------------------
// Contract
// ---------------------------------------------------------------------------

export interface ChatStore {
  createConversation(title?: string): Promise<Conversation>;
  getConversation(conversationId: string): Promise<ConversationWithMessages | null>;
  listConversations(): Promise<Conversation[]>;
  updateConversationTitle(conversationId: string, title: string): Promise<void>;
  deleteConversation(conversationId: string): Promise<void>;
  addMessage(conversationId: string, message: ChatMessage): Promise<void>;
  getMessages(conversationId: string): Promise<ChatMessage[]>;
}

// ---------------------------------------------------------------------------
// Default in-memory implementation
// ---------------------------------------------------------------------------

class InMemoryChatStore implements ChatStore {
  private conversations = new Map<string, Conversation>();
  private messages = new Map<string, ChatMessage[]>();

  async createConversation(title = "New conversation"): Promise<Conversation> {
    const now = new Date().toISOString();
    const conversation: Conversation = {
      id: crypto.randomUUID(),
      title,
      createdAt: now,
      updatedAt: now,
    };
    this.conversations.set(conversation.id, conversation);
    this.messages.set(conversation.id, []);
    return conversation;
  }

  async getConversation(conversationId: string): Promise<ConversationWithMessages | null> {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) return null;
    return { ...conversation, messages: this.messages.get(conversationId) ?? [] };
  }

  async listConversations(): Promise<Conversation[]> {
    return Array.from(this.conversations.values()).sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  async updateConversationTitle(conversationId: string, title: string): Promise<void> {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) return;
    conversation.title = title;
    conversation.updatedAt = new Date().toISOString();
  }

  async deleteConversation(conversationId: string): Promise<void> {
    this.conversations.delete(conversationId);
    this.messages.delete(conversationId);
  }

  async addMessage(conversationId: string, message: ChatMessage): Promise<void> {
    const list = this.messages.get(conversationId);
    if (!list) return;
    list.push(message);

    const conversation = this.conversations.get(conversationId);
    if (conversation) {
      conversation.updatedAt = new Date().toISOString();
    }
  }

  async getMessages(conversationId: string): Promise<ChatMessage[]> {
    return this.messages.get(conversationId) ?? [];
  }
}

// ---------------------------------------------------------------------------
// Active store (swappable)
// ---------------------------------------------------------------------------

let activeStore: ChatStore = new InMemoryChatStore();

/**
 * Replace the active ChatStore. Call this once at app startup (e.g. in an
 * instrumentation file or a module loaded early) to plug in your own
 * persistence layer instead of the default in-memory one.
 *
 * @example
 * import { setChatStore } from "./store";
 * setChatStore(new PostgresChatStore(db));
 */
export function setChatStore(store: ChatStore): void {
  activeStore = store;
}

/** Returns the currently active ChatStore. Used internally by service.ts. */
export function getChatStore(): ChatStore {
  return activeStore;
}
