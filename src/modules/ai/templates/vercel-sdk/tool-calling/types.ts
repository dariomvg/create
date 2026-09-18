/**
 * Types for the Vercel AI SDK Tool Calling module (Google provider).
 * Shared across tools.ts, service.ts and actions.ts.
 *
 * Standalone module — does not depend on the text-generation or chat
 * modules, even though some shapes look similar.
 */

// ---------------------------------------------------------------------------
// Model / provider configuration
// ---------------------------------------------------------------------------

export const DEFAULT_MODEL = "gemini-1.5-pro";
export const DEFAULT_TEMPERATURE = 0.7;
export const DEFAULT_MAX_TOKENS = 1024;

/** Simple in-memory rate limit guard. Per-server-instance only. */
export const RATE_LIMIT_CONFIG = {
  maxRequests: 20,
  windowMs: 60_000, // 1 minute
};

/**
 * Caps how many AI → Tool → AI round trips a single run can take
 * (the model can call a tool, read the result, then call another tool
 * or respond, up to this many steps).
 */
export const TOOL_LOOP_CONFIG = {
  maxSteps: 5,
};

// ---------------------------------------------------------------------------
// Tool definition (registered via tools.ts)
// ---------------------------------------------------------------------------

export interface ToolDefinition<TParams = unknown, TResult = unknown> {
  /** Unique name the model uses to call this tool. */
  name: string;
  /** Description shown to the model — what the tool does and when to use it. */
  description: string;
  /** Zod schema the model's arguments are validated against. */
  parameters: import("zod").ZodType<TParams>;
  /** Runs the tool — this is where you call your Database/API. */
  execute: (params: TParams) => Promise<TResult> | TResult;
}

// ---------------------------------------------------------------------------
// Running a prompt with tools
// ---------------------------------------------------------------------------

export interface RunWithToolsParams {
  prompt: string;
  system?: string;
  temperature?: number;
  maxTokens?: number;
  model?: string;
  /** Which registered tools to make available. Defaults to all registered tools. */
  toolNames?: string[];
}

/** One tool call made during a run, and its outcome. */
export interface ToolCallTrace {
  toolName: string;
  args: unknown;
  result?: unknown;
  error?: string;
}

export interface RunWithToolsResult {
  /** The model's final text response, after any tool calls. */
  text: string;
  /** Every tool call made during the run, in order. */
  toolCalls: ToolCallTrace[];
  finishReason: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export type AIErrorCode =
  | "RATE_LIMITED"
  | "INVALID_REQUEST"
  | "PROVIDER_ERROR"
  | "TOOL_VALIDATION_ERROR"
  | "TOOL_EXECUTION_ERROR"
  | "UNKNOWN";

export interface AIServiceError {
  code: AIErrorCode;
  message: string;
  /** Seconds to wait before retrying. Only set when code is RATE_LIMITED. */
  retryAfter?: number;
}

export type AIResult<T> =
  | { success: true; data: T }
  | { success: false; error: AIServiceError };
