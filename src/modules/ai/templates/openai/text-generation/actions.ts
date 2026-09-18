"use server";

import { generateText as generateTextService } from "./service";
import { generateStructuredOutput as generateStructuredOutputService } from "./service";
import { toAIError } from "./service";
import type {
  GenerateTextOptions,
  GenerateTextResult,
  GenerateStructuredOutputOptions,
  GenerateStructuredOutputResult,
  AIActionResult,
} from "./types";

// ============================================================================
// OpenAI Text Generation — Public server actions
// Import these from Server Components / server-side form actions.
// For streaming, use lib/openai/client.ts from a client component instead.
// ============================================================================

/**
 * Generates a single text completion (non-streaming).
 * Never throws — check `result.ok` before reading `result.data`/`result.error`.
 */
export async function generateTextAction(
  options: GenerateTextOptions
): Promise<AIActionResult<GenerateTextResult>> {
  try {
    const data = await generateTextService(options);
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: toAIError(err) };
  }
}

/**
 * Generates a JSON response validated against `options.schema`.
 * Never throws — check `result.ok` before reading `result.data`/`result.error`.
 */
export async function generateStructuredOutputAction<T = unknown>(
  options: GenerateStructuredOutputOptions
): Promise<AIActionResult<GenerateStructuredOutputResult<T>>> {
  try {
    const data = await generateStructuredOutputService<T>(options);
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: toAIError(err) };
  }
}
