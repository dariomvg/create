"use server";

/**
 * Server Actions for the Anthropic Tool Calling module.
 *
 * Single entrypoint: runWithTools() runs the full model↔tool loop and
 * returns the final answer plus a record of every tool call made.
 */

import { runWithToolsService } from "./service";
import type { AIResult, RunOptions, RunResult } from "./types";

/**
 * Runs a prompt against the model with all registered tools (see tools.ts)
 * available. The model may call one or more tools before producing its
 * final text answer — this function handles the full round-trip.
 *
 * @example
 * const result = await runWithTools("What's the weather in Tokyo?");
 * if (result.error) {
 *   // result.error.code, result.error.message (and result.error.toolName if tool-related)
 * } else {
 *   console.log(result.data.text);
 *   console.log(result.data.toolCalls); // which tools ran and what they returned
 * }
 */
export async function runWithTools(
  prompt: string,
  options?: RunOptions
): Promise<AIResult<RunResult>> {
  return runWithToolsService(prompt, options);
}
