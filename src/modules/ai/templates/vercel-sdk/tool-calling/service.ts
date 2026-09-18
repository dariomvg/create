/**
 * Internal service logic for the Vercel AI SDK Tool Calling module.
 * Not meant to be imported directly by consumers — use actions.ts instead.
 */

import {
  generateText,
  tool as aiTool,
  isStepCount,
  APICallError,
  InvalidToolInputError,
  NoSuchToolError,
} from "ai";
import { google } from "@ai-sdk/google";
import { getTools } from "./tools";
import type {
  ToolDefinition,
  RunWithToolsParams,
  RunWithToolsResult,
  ToolCallTrace,
  AIResult,
  AIServiceError,
} from "./types";
import {
  DEFAULT_MODEL,
  DEFAULT_TEMPERATURE,
  DEFAULT_MAX_TOKENS,
  RATE_LIMIT_CONFIG,
  TOOL_LOOP_CONFIG,
} from "./types";

// ---------------------------------------------------------------------------
// In-memory rate limiter
// ---------------------------------------------------------------------------

const requestTimestamps: number[] = [];

function checkRateLimit(): AIServiceError | null {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_CONFIG.windowMs;

  while (requestTimestamps.length > 0 && requestTimestamps[0] < windowStart) {
    requestTimestamps.shift();
  }

  if (requestTimestamps.length >= RATE_LIMIT_CONFIG.maxRequests) {
    const retryAfter = Math.ceil(
      (requestTimestamps[0] + RATE_LIMIT_CONFIG.windowMs - now) / 1000
    );
    return {
      code: "RATE_LIMITED",
      message: "Too many requests. Please wait before trying again.",
      retryAfter: Math.max(retryAfter, 1),
    };
  }

  requestTimestamps.push(now);
  return null;
}

// ---------------------------------------------------------------------------
// Error normalization
// ---------------------------------------------------------------------------

function normalizeError(error: unknown): AIServiceError {
  // The model called a tool with arguments that don't match its schema.
  if (InvalidToolInputError.isInstance(error)) {
    return {
      code: "TOOL_VALIDATION_ERROR",
      message: `The model called "${error.toolName}" with invalid arguments.`,
    };
  }

  // The model tried to call a tool that wasn't made available to it.
  if (NoSuchToolError.isInstance(error)) {
    return {
      code: "TOOL_VALIDATION_ERROR",
      message: `The model tried to call an unknown tool: "${error.toolName}".`,
    };
  }

  if (APICallError.isInstance(error)) {
    if (error.statusCode === 429) {
      const retryAfterHeader = error.responseHeaders?.["retry-after"];
      return {
        code: "RATE_LIMITED",
        message: "The provider rate-limited this request. Please try again shortly.",
        retryAfter: retryAfterHeader ? Number(retryAfterHeader) : undefined,
      };
    }

    if (error.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
      return {
        code: "INVALID_REQUEST",
        message: "The request was rejected by the provider. Please check the input.",
      };
    }

    return {
      code: "PROVIDER_ERROR",
      message: "The AI provider is currently unavailable. Please try again later.",
    };
  }

  return {
    code: "UNKNOWN",
    message: "Something went wrong while generating a response.",
  };
}

// ---------------------------------------------------------------------------
// Tool definitions → AI SDK tool objects
// ---------------------------------------------------------------------------

function buildAiTools(definitions: ToolDefinition[]) {
  const tools: Record<string, ReturnType<typeof aiTool>> = {};

  for (const def of definitions) {
    tools[def.name] = aiTool({
      description: def.description,
      inputSchema: def.parameters,
      // Errors thrown here are NOT re-thrown to the caller — the AI SDK
      // captures them as a tool-error result, lets the model see the
      // failure, and keeps the run alive for multi-step recovery. We
      // read the outcome afterwards via onToolExecutionEnd below.
      execute: def.execute,
    });
  }

  return tools;
}

// ---------------------------------------------------------------------------
// Run a prompt with tools
// ---------------------------------------------------------------------------

export async function runWithToolsService(
  params: RunWithToolsParams
): Promise<AIResult<RunWithToolsResult>> {
  const rateLimitError = checkRateLimit();
  if (rateLimitError) return { success: false, error: rateLimitError };

  const toolsResult = getTools(params.toolNames);
  if (!toolsResult.success) return toolsResult;

  const toolCalls: ToolCallTrace[] = [];

  try {
    const result = await generateText({
      model: google(params.model ?? DEFAULT_MODEL),
      system: params.system,
      prompt: params.prompt,
      temperature: params.temperature ?? DEFAULT_TEMPERATURE,
      maxOutputTokens: params.maxTokens ?? DEFAULT_MAX_TOKENS,
      tools: buildAiTools(toolsResult.data),
      stopWhen: isStepCount(TOOL_LOOP_CONFIG.maxSteps),
      // Records every tool call's outcome (result or error) as it finishes,
      // regardless of which step it happened in.
      onToolExecutionEnd({ toolCall, toolOutput }) {
        const trace: ToolCallTrace = {
          toolName: toolCall.toolName,
          args: toolCall.input,
        };

        if (toolOutput.type === "tool-error") {
          trace.error =
            toolOutput.error instanceof Error
              ? toolOutput.error.message
              : String(toolOutput.error);
        } else {
          trace.result = toolOutput.output;
        }

        toolCalls.push(trace);
      },
    });

    return {
      success: true,
      data: {
        text: result.text,
        toolCalls,
        finishReason: result.finishReason,
        usage: {
          promptTokens: result.usage.inputTokens ?? 0,
          completionTokens: result.usage.outputTokens ?? 0,
          totalTokens: result.usage.totalTokens ?? 0,
        },
      },
    };
  } catch (error) {
    return { success: false, error: normalizeError(error) };
  }
}
