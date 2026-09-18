import "server-only";
import OpenAI from "openai";
import Ajv, { type ValidateFunction } from "ajv";
import { createToolRegistry } from "./tools";
import {
  DEFAULT_MODEL,
  DEFAULT_MAX_OUTPUT_TOKENS,
  MAX_ALLOWED_OUTPUT_TOKENS,
  DEFAULT_TEMPERATURE,
  DEFAULT_MAX_TOOL_ROUNDTRIPS,
  RATE_LIMIT_CONFIG,
  type RunWithToolsOptions,
  type RunWithToolsResult,
  type ExecutedToolCall,
  type ToolDefinition,
  type AIActionError,
  type AIErrorCode,
} from "./types";

// ============================================================================
// OpenAI Tool Calling — Service (internal)
// Direct SDK usage + the AI ↔ tool execution loop. Do not import from client
// components — use actions.ts instead.
// ============================================================================

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (client) return client;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw toAIError({ code: "AUTH_ERROR" });
  }

  client = new OpenAI({ apiKey });
  return client;
}

// ---------------------------------------------------------------------------
// Error normalization
// ---------------------------------------------------------------------------

const AI_ERROR_CODES = [
  "RATE_LIMITED",
  "INVALID_REQUEST",
  "AUTH_ERROR",
  "TIMEOUT",
  "TOOL_NOT_FOUND",
  "TOOL_VALIDATION_ERROR",
  "TOOL_EXECUTION_ERROR",
  "UNKNOWN",
];

function isAIActionError(source: unknown): source is AIActionError {
  return (
    typeof source === "object" &&
    source !== null &&
    "code" in source &&
    "message" in source &&
    "retryable" in source &&
    AI_ERROR_CODES.includes((source as { code: string }).code)
  );
}

/** Builds a normalized tool-related error. Used to stop the loop immediately on tool failure. */
function toolError(code: AIErrorCode, message: string, toolName: string): AIActionError {
  return { code, message, retryable: false, toolName };
}

function toAIError(source: unknown): AIActionError {
  if (isAIActionError(source)) {
    return source;
  }

  if (
    typeof source === "object" &&
    source !== null &&
    "code" in source &&
    (source as { code: string }).code === "AUTH_ERROR"
  ) {
    return {
      code: "AUTH_ERROR",
      message: "OpenAI API key is missing or invalid. Check your server configuration.",
      retryable: false,
    };
  }

  if (source instanceof OpenAI.APIError) {
    if (source.status === 429) {
      const retryAfterHeader = source.headers?.["retry-after"];
      const retryAfter = retryAfterHeader
        ? Number(retryAfterHeader)
        : RATE_LIMIT_CONFIG.defaultRetryAfterSeconds;

      return {
        code: "RATE_LIMITED",
        message: "Too many requests right now. Please wait and try again.",
        retryable: true,
        retryAfter,
      };
    }

    if (source.status === 401 || source.status === 403) {
      return {
        code: "AUTH_ERROR",
        message: "OpenAI rejected the request credentials.",
        retryable: false,
      };
    }

    if (source.status === 400) {
      return {
        code: "INVALID_REQUEST",
        message: source.message || "The request was invalid.",
        retryable: false,
      };
    }
  }

  if (source instanceof Error && source.name === "APIConnectionTimeoutError") {
    return {
      code: "TIMEOUT",
      message: "The request to OpenAI timed out. Please try again.",
      retryable: true,
    };
  }

  return {
    code: "UNKNOWN",
    message: "Something went wrong while processing your request.",
    retryable: false,
  };
}

async function withRateLimitRetry<T>(fn: () => Promise<T>): Promise<T> {
  let attempt = 0;

  while (true) {
    try {
      return await fn();
    } catch (err) {
      const isRateLimit = err instanceof OpenAI.APIError && err.status === 429;

      if (!isRateLimit || attempt >= RATE_LIMIT_CONFIG.maxRetries) {
        throw toAIError(err);
      }

      const delay = RATE_LIMIT_CONFIG.baseRetryDelayMs * 2 ** attempt;
      await new Promise((resolve) => setTimeout(resolve, delay));
      attempt++;
    }
  }
}

function clampMaxTokens(value: number | undefined): number {
  const requested = value ?? DEFAULT_MAX_OUTPUT_TOKENS;
  return Math.min(requested, MAX_ALLOWED_OUTPUT_TOKENS);
}

// ---------------------------------------------------------------------------
// Tool schema validation (ajv)
// ---------------------------------------------------------------------------

function buildValidators(tools: ToolDefinition[]): Map<string, ValidateFunction> {
  const ajv = new Ajv({ allErrors: true, strict: false });
  const validators = new Map<string, ValidateFunction>();

  for (const tool of tools) {
    validators.set(tool.name, ajv.compile(tool.parameters));
  }

  return validators;
}

function toOpenAITool(tool: ToolDefinition): OpenAI.ChatCompletionTool {
  return {
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  };
}

// ---------------------------------------------------------------------------
// AI ↔ Tool loop
//
//   AI → Tool → Database/API → Result → AI
//
// Sends the conversation + available tools to OpenAI. If the model requests
// tool calls, each one is validated (ajv) against its schema and executed
// via ToolDefinition.execute, and the result is fed back to the model. This
// repeats until the model replies with plain text or maxToolRoundtrips is
// reached. If a tool is unknown, fails validation, or throws during
// execution, the loop stops immediately and the normalized error is thrown
// — it is not fed back to the model to self-recover.
// ---------------------------------------------------------------------------

export async function runWithTools(
  options: RunWithToolsOptions
): Promise<RunWithToolsResult> {
  const openai = getClient();
  const registry = createToolRegistry(options.tools);
  const validators = buildValidators(options.tools);
  const openaiTools = options.tools.map(toOpenAITool);
  const maxRoundtrips = options.maxToolRoundtrips ?? DEFAULT_MAX_TOOL_ROUNDTRIPS;

  const messages: OpenAI.ChatCompletionMessageParam[] = options.messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const executedToolCalls: ExecutedToolCall[] = [];
  let completion: OpenAI.ChatCompletion | undefined;

  for (let round = 0; round <= maxRoundtrips; round++) {
    completion = await withRateLimitRetry(() =>
      openai.chat.completions.create({
        model: options.model ?? DEFAULT_MODEL,
        messages,
        temperature: options.temperature ?? DEFAULT_TEMPERATURE,
        max_tokens: clampMaxTokens(options.maxOutputTokens),
        tools: openaiTools,
      })
    );

    const choice = completion.choices[0];
    const requestedCalls = choice?.message?.tool_calls;

    if (!requestedCalls || requestedCalls.length === 0) {
      return buildResult(choice?.message?.content ?? "", executedToolCalls, completion);
    }

    messages.push(choice.message as OpenAI.ChatCompletionMessageParam);

    for (const call of requestedCalls) {
      const tool = registry.get(call.function.name);
      if (!tool) {
        throw toolError(
          "TOOL_NOT_FOUND",
          `The model requested an unknown tool: "${call.function.name}"`,
          call.function.name
        );
      }

      let args: Record<string, unknown>;
      try {
        args = JSON.parse(call.function.arguments || "{}");
      } catch {
        throw toolError(
          "TOOL_VALIDATION_ERROR",
          `Tool "${tool.name}" received malformed JSON arguments`,
          tool.name
        );
      }

      const validate = validators.get(tool.name)!;
      if (!validate(args)) {
        throw toolError(
          "TOOL_VALIDATION_ERROR",
          `Arguments for tool "${tool.name}" failed schema validation: ${ajvErrorsText(
            validate.errors
          )}`,
          tool.name
        );
      }

      let result: unknown;
      try {
        result = await tool.execute(args);
      } catch (err) {
        throw toolError(
          "TOOL_EXECUTION_ERROR",
          err instanceof Error ? err.message : `Tool "${tool.name}" failed to execute`,
          tool.name
        );
      }

      executedToolCalls.push({ toolName: tool.name, args, result });

      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify(result),
      });
    }
  }

  // Round trip budget exhausted — return whatever text the last completion has.
  return buildResult(completion?.choices[0]?.message?.content ?? "", executedToolCalls, completion);
}

function buildResult(
  text: string,
  toolCalls: ExecutedToolCall[],
  completion: OpenAI.ChatCompletion | undefined
): RunWithToolsResult {
  return {
    text,
    toolCalls,
    model: completion?.model ?? DEFAULT_MODEL,
    usage: completion?.usage
      ? {
          promptTokens: completion.usage.prompt_tokens,
          completionTokens: completion.usage.completion_tokens,
          totalTokens: completion.usage.total_tokens,
        }
      : undefined,
  };
}

function ajvErrorsText(errors: ValidateFunction["errors"]): string {
  if (!errors || errors.length === 0) return "unknown validation error";
  return errors.map((e) => `${e.instancePath || "value"} ${e.message}`).join(", ");
}

export { toAIError };
