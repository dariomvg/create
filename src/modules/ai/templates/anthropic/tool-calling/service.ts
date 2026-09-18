/**
 * Internal service layer for the Anthropic Tool Calling module.
 *
 * Runs the full model↔tool loop: calls the model with the registered
 * tools, executes any tool the model calls, feeds the result back, and
 * repeats until the model returns a final text answer (or the iteration
 * cap is hit). Consumers should NOT import from here directly — use
 * actions.ts instead.
 */

import Anthropic from "@anthropic-ai/sdk";
import Ajv, { type ValidateFunction } from "ajv";
import { getTool, listToolDefinitions } from "./tools";
import type {
  AIError,
  AIResult,
  RunOptions,
  RunResult,
  ToolCallRecord,
} from "./types";
import {
  DEFAULT_MODEL,
  DEFAULT_MAX_TOKENS,
  DEFAULT_TEMPERATURE,
  DEFAULT_MAX_TOOL_ITERATIONS,
  RATE_LIMIT_DEFAULT_RETRY_AFTER_SECONDS,
} from "./types";

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error(
        "Missing ANTHROPIC_API_KEY environment variable. Check SETUP.md."
      );
    }
    client = new Anthropic({ apiKey });
  }
  return client;
}

// ---------------------------------------------------------------------------
// Schema validation (cached compiled validators)
// ---------------------------------------------------------------------------

const ajv = new Ajv();
const validatorCache = new Map<string, ValidateFunction>();

function getValidator(toolName: string, schema: Record<string, unknown>): ValidateFunction {
  let validator = validatorCache.get(toolName);
  if (!validator) {
    validator = ajv.compile(schema);
    validatorCache.set(toolName, validator);
  }
  return validator;
}

// ---------------------------------------------------------------------------
// Error normalization
// ---------------------------------------------------------------------------

function normalizeError(err: unknown): AIError {
  if (err instanceof Anthropic.APIError) {
    const status = err.status;

    if (status === 401 || status === 403) {
      return {
        code: "authentication_error",
        message: "Authentication failed. Check your ANTHROPIC_API_KEY.",
      };
    }

    if (status === 429) {
      const retryAfterHeader = err.headers?.["retry-after"];
      const retryAfter = retryAfterHeader
        ? Number(retryAfterHeader)
        : RATE_LIMIT_DEFAULT_RETRY_AFTER_SECONDS;

      return {
        code: "rate_limited",
        message: "Rate limit exceeded. Please try again shortly.",
        retryAfter,
      };
    }

    if (status === 529) {
      return {
        code: "overloaded",
        message: "The model is temporarily overloaded. Please try again.",
      };
    }

    if (status === 400) {
      return {
        code: "invalid_request",
        message: err.message || "Invalid request sent to the model.",
      };
    }

    return { code: "unknown_error", message: err.message || "An unexpected error occurred." };
  }

  if (err instanceof Anthropic.APIConnectionError) {
    return {
      code: "network_error",
      message: "Could not reach the Anthropic API. Check your connection.",
    };
  }

  return {
    code: "unknown_error",
    message: err instanceof Error ? err.message : "An unexpected error occurred.",
  };
}

// ---------------------------------------------------------------------------
// Tool-calling loop
// ---------------------------------------------------------------------------

export async function runWithToolsService(
  prompt: string,
  options?: RunOptions
): Promise<AIResult<RunResult>> {
  const anthropic = getClient();
  const model = options?.model ?? DEFAULT_MODEL;
  const maxIterations = options?.maxToolIterations ?? DEFAULT_MAX_TOOL_ITERATIONS;
  const toolDefinitions = listToolDefinitions();
  const toolCalls: ToolCallRecord[] = [];

  const messages: Anthropic.MessageParam[] = [{ role: "user", content: prompt }];

  try {
    for (let iteration = 0; iteration < maxIterations; iteration++) {
      const response = await anthropic.messages.create({
        model,
        max_tokens: options?.maxTokens ?? DEFAULT_MAX_TOKENS,
        temperature: options?.temperature ?? DEFAULT_TEMPERATURE,
        system: options?.systemPrompt,
        messages,
        tools: toolDefinitions,
      });

      const toolUseBlocks = response.content.filter(
        (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
      );

      // No tool calls left — this is the final answer.
      if (toolUseBlocks.length === 0) {
        const textBlock = response.content.find((block) => block.type === "text");

        return {
          data: {
            text: textBlock?.type === "text" ? textBlock.text : "",
            toolCalls,
            model: response.model,
            stopReason: response.stop_reason,
            usage: {
              inputTokens: response.usage.input_tokens,
              outputTokens: response.usage.output_tokens,
            },
          },
        };
      }

      // Execute every requested tool call, validating input first.
      const toolResultBlocks: Anthropic.ToolResultBlockParam[] = [];

      for (const block of toolUseBlocks) {
        const tool = getTool(block.name);

        if (!tool) {
          return {
            error: {
              code: "tool_validation_error",
              message: `Tool "${block.name}" is not registered.`,
              toolName: block.name,
            },
          };
        }

        const validate = getValidator(tool.definition.name, tool.definition.input_schema);
        if (!validate(block.input)) {
          return {
            error: {
              code: "tool_validation_error",
              message: `Invalid input for tool "${block.name}": ${ajv.errorsText(validate.errors)}`,
              toolName: block.name,
            },
          };
        }

        try {
          const output = await tool.execute(block.input);
          toolCalls.push({ toolName: block.name, input: block.input, output });
          toolResultBlocks.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: JSON.stringify(output),
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Tool execution failed.";
          toolCalls.push({ toolName: block.name, input: block.input, error: message });

          return {
            error: { code: "tool_execution_error", message, toolName: block.name },
          };
        }
      }

      // Feed the tool results back and continue the loop.
      messages.push({ role: "assistant", content: response.content });
      messages.push({ role: "user", content: toolResultBlocks });
    }

    return {
      error: {
        code: "max_iterations_exceeded",
        message: `Exceeded the maximum of ${maxIterations} tool-calling iterations.`,
      },
    };
  } catch (err) {
    return { error: normalizeError(err) };
  }
}
