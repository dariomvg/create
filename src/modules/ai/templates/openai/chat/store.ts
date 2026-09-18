import "server-only";
import type { ChatMessage, Conversation } from "./types";

// ============================================================================
// OpenAI Chat — History store
// Defines the persistence contract used by service.ts. Ships with an
// in-memory implementation for local development only.
//
// ⚠️ Replace `createInMemoryChatStore` with a real database-backed
// implementation before deploying — in-memory data is lost on every
// server restart and isn't shared across serverless instances.
// ============================================================================

/** Thrown by store implementations when a conversation id doesn't exist. */
export class ConversationNotFoundError extends Error {
  constructor(conversationId: string) {
    super(`Conversation "${conversationId}" not found`);
    this.name = "ConversationNotFoundError";
  }
}

export interface ChatHistoryStore {
  createConversation(title?: string): Promise<Conversation>;
  getConversation(id: string): Promise<Conversation | null>;
  listConversations(): Promise<Conversation[]>;
  renameConversation(id: string, title: string): Promise<Conversation>;
  deleteConversation(id: string): Promise<void>;

  addMessage(
    conversationId: string,
    message: Pick<ChatMessage, "role" | "content">
  ): Promise<ChatMessage>;
  getMessages(conversationId: string): Promise<ChatMessage[]>;
}

// ---------------------------------------------------------------------------
// In-memory reference implementation
// ---------------------------------------------------------------------------

function createInMemoryChatStore(): ChatHistoryStore {
  const conversations = new Map<string, Conversation>();
  const messages = new Map<string, ChatMessage[]>();

  return {
    async createConversation(title = "New conversation") {
      const now = new Date().toISOString();
      const conversation: Conversation = {
        id: crypto.randomUUID(),
        title,
        createdAt: now,
        updatedAt: now,
      };
      conversations.set(conversation.id, conversation);
      messages.set(conversation.id, []);
      return conversation;
    },

    async getConversation(id) {
      return conversations.get(id) ?? null;
    },

    async listConversations() {
      return Array.from(conversations.values()).sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
    },

    async renameConversation(id, title) {
      const conversation = conversations.get(id);
      if (!conversation) {
        throw new ConversationNotFoundError(id);
      }
      conversation.title = title;
      conversation.updatedAt = new Date().toISOString();
      return conversation;
    },

    async deleteConversation(id) {
      conversations.delete(id);
      messages.delete(id);
    },

    async addMessage(conversationId, message) {
      const conversation = conversations.get(conversationId);
      if (!conversation) {
        throw new ConversationNotFoundError(conversationId);
      }

      const fullMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: message.role,
        content: message.content,
        createdAt: new Date().toISOString(),
      };

      const history = messages.get(conversationId) ?? [];
      history.push(fullMessage);
      messages.set(conversationId, history);

      conversation.updatedAt = fullMessage.createdAt;

      return fullMessage;
    },

    async getMessages(conversationId) {
      return messages.get(conversationId) ?? [];
    },
  };
}

// ---------------------------------------------------------------------------
// Singleton accessor used by service.ts
// Swap the implementation here once you have a real database.
// ---------------------------------------------------------------------------

let store: ChatHistoryStore | null = null;

export function getChatStore(): ChatHistoryStore {
  if (!store) {
    store = createInMemoryChatStore();
  }
  return store;
}
