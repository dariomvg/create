/**
 * Shared types for the Anthropic Tool Calling module.
 * This file has no side effects and can be safely imported anywhere.
 */

// ---------------------------------------------------------------------------
// Model / generation configuration
// ---------------------------------------------------------------------------

export const DEFAULT_MODEL = "claude-sonnet-4-6";
export const DEFAULT_MAX_TOKENS = 1024;
export const DEFAULT_TEMPERATURE = 1;

/** Safety cap on how many model↔tool round-trips a single run can take. */
export const DEFAULT_MAX_TOOL_ITERATIONS = 5;

export interface RunOptions {
  model?: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  /** Overrides DEFAULT_MAX_TOOL_ITERATIONS for this run. */
  maxToolIterations?: number;
}

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

/** Anthropic-native tool definition sent to the API. */
export interface ToolDefinition {
  name: string;
  description: string;
  /** JSON schema describing the tool's input. */
  input_schema: Record<string, unknown>;
}

/**
 * A registered tool: its definition plus the function that actually runs
 * it. execute() receives input already validated against input_schema.
 */
export interface Tool<TInput = any, TOutput = unknown> {
  definition: ToolDefinition;
  execute: (input: TInput) => Promise<TOutput>;
}

/** Record of a single tool call made during a run. */
export interface ToolCallRecord {
  toolName: string;
  input: unknown;
  output?: unknown;
  /** Set only if this specific tool call failed. */
  error?: string;
}

// ---------------------------------------------------------------------------
// Run result
// ---------------------------------------------------------------------------

export interface RunResult {
  /** The model's final text response, after all tool calls resolved. */
  text: string;
  /** Every tool call made during this run, in order. */
  toolCalls: ToolCallRecord[];
  model: string;
  stopReason: string | null;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export type AIErrorCode =
  | "invalid_request"
  | "authentication_error"
  | "rate_limited"
  | "overloaded"
  | "network_error"
  | "tool_validation_error"
  | "tool_execution_error"
  | "max_iterations_exceeded"
  | "unknown_error";

export interface AIError {
  code: AIErrorCode;
  message: string;
  retryAfter?: number;
  /** Name of the tool involved, present for tool_validation_error / tool_execution_error. */
  toolName?: string;
}

export type AIResult<T> = { data: T; error?: never } | { data?: never; error: AIError };

export const RATE_LIMIT_DEFAULT_RETRY_AFTER_SECONDS = 30;
