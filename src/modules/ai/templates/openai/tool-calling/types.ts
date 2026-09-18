// ============================================================================
// OpenAI Tool Calling — Types
// ============================================================================

// ---------------------------------------------------------------------------
// Default configuration
// (Same convention as the other modules: no separate constants file.)
// ---------------------------------------------------------------------------

export const DEFAULT_MODEL = "gpt-4o-mini";

export const DEFAULT_MAX_OUTPUT_TOKENS = 1024;

export const MAX_ALLOWED_OUTPUT_TOKENS = 4096;

export const DEFAULT_TEMPERATURE = 0.7;

/** Max AI ↔ tool round trips before giving up and returning whatever text the model has produced. */
export const DEFAULT_MAX_TOOL_ROUNDTRIPS = 5;

export const RATE_LIMIT_CONFIG = {
  maxRetries: 2,
  baseRetryDelayMs: 500,
  defaultRetryAfterSeconds: 20,
} as const;

// ---------------------------------------------------------------------------
// Input messages
// Deliberately minimal/agnostic — the caller (e.g. an external chat module)
// supplies whatever history it wants in this shape. This module doesn't
// know about conversations, storage, or any other chat concept.
// ---------------------------------------------------------------------------

export type ToolChatRole = "system" | "user" | "assistant";

export interface ToolChatMessage {
  role: ToolChatRole;
  content: string;
}

// ---------------------------------------------------------------------------
// Tool definition
// ---------------------------------------------------------------------------

export interface ToolDefinition<TArgs = Record<string, unknown>, TResult = unknown> {
  /** Unique name — this is what the model uses to call the tool. */
  name: string;
  /** Description shown to the model — the main signal it uses to decide when to call this tool. */
  description: string;
  /** JSON Schema describing the expected arguments. */
  parameters: Record<string, unknown>;
  /** Runs the tool against your DB/API and returns the result. Throw to signal failure. */
  execute: (args: TArgs) => Promise<TResult>;
}

// ---------------------------------------------------------------------------
// Run options / result
// ---------------------------------------------------------------------------

export interface RunWithToolsOptions {
  messages: ToolChatMessage[];
  /** Tools available to the model for this run. */
  tools: ToolDefinition[];
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
  /** Caps AI ↔ tool round trips. Defaults to DEFAULT_MAX_TOOL_ROUNDTRIPS. */
  maxToolRoundtrips?: number;
}

/** Record of a single tool invocation, returned for transparency/logging. */
export interface ExecutedToolCall {
  toolName: string;
  args: Record<string, unknown>;
  result: unknown;
}

export interface RunWithToolsResult {
  /** The model's final text reply, after all tool calls are resolved. */
  text: string;
  /** Every tool call that was executed, in order. */
  toolCalls: ExecutedToolCall[];
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

// ---------------------------------------------------------------------------
// Normalized error handling
// ---------------------------------------------------------------------------

export type AIErrorCode =
  | "RATE_LIMITED"
  | "INVALID_REQUEST"
  | "AUTH_ERROR"
  | "TIMEOUT"
  | "TOOL_NOT_FOUND"
  | "TOOL_VALIDATION_ERROR"
  | "TOOL_EXECUTION_ERROR"
  | "UNKNOWN";

export interface AIActionError {
  code: AIErrorCode;
  message: string;
  retryable: boolean;
  retryAfter?: number;
  /** Set when the error came from a specific tool (TOOL_* codes). */
  toolName?: string;
}

export type AIActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: AIActionError };
