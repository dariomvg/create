// ============================================================================
// OpenAI Chat — Types
// ============================================================================

// ---------------------------------------------------------------------------
// Default configuration
// (Same convention as the Text Generation module: no separate constants
// file — defaults and rate limit config live here.)
// ---------------------------------------------------------------------------

export const DEFAULT_CHAT_MODEL = "gpt-4o-mini";

export const DEFAULT_MAX_OUTPUT_TOKENS = 1024;

export const MAX_ALLOWED_OUTPUT_TOKENS = 4096;

export const DEFAULT_TEMPERATURE = 0.7;

/** Approximate max context size (in characters, not exact tokens) kept when trimming history. See context.ts. */
export const DEFAULT_CONTEXT_CHAR_BUDGET = 12000;

export const DEFAULT_STT_MODEL = "whisper-1";

export const DEFAULT_TTS_MODEL = "tts-1";

export const DEFAULT_TTS_VOICE = "alloy";

export const RATE_LIMIT_CONFIG = {
  maxRetries: 2,
  baseRetryDelayMs: 500,
  defaultRetryAfterSeconds: 20,
} as const;

// ---------------------------------------------------------------------------
// Chat messages & conversations
// ---------------------------------------------------------------------------

export type ChatRole = "system" | "user" | "assistant";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Chat completion options
// ---------------------------------------------------------------------------

export interface ChatCompletionOptions {
  conversationId: string;
  /** New user message to send. Prior history is loaded from the store. */
  message: string;
  systemPrompt?: string;
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
}

export interface ChatCompletionResult {
  message: ChatMessage;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

// ---------------------------------------------------------------------------
// Speech-to-text
// ---------------------------------------------------------------------------

export interface TranscribeAudioOptions {
  /** Audio file (webm, mp3, wav, etc.) — whatever the browser/recorder produced. */
  file: File;
  model?: string;
  /** Optional hint language (ISO-639-1), improves accuracy. */
  language?: string;
}

export interface TranscribeAudioResult {
  text: string;
}

// ---------------------------------------------------------------------------
// Text-to-speech
// ---------------------------------------------------------------------------

export interface SynthesizeSpeechOptions {
  text: string;
  model?: string;
  voice?: string;
}

// ---------------------------------------------------------------------------
// Normalized error handling (same shape as the Text Generation module)
// ---------------------------------------------------------------------------

export type AIErrorCode =
  | "RATE_LIMITED"
  | "INVALID_REQUEST"
  | "AUTH_ERROR"
  | "TIMEOUT"
  | "NOT_FOUND"
  | "UNKNOWN";

export interface AIActionError {
  code: AIErrorCode;
  message: string;
  retryable: boolean;
  retryAfter?: number;
}

export type AIActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: AIActionError };
