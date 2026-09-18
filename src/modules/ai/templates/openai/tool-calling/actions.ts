"use server";

import { runWithTools, toAIError } from "./service";
import type { RunWithToolsOptions, RunWithToolsResult, AIActionResult } from "./types";

// ============================================================================
// OpenAI Tool Calling — Public server action
// Import this from your chat's server-side code (Server Component, server
// action, or any backend logic). Pass it whatever message history your own
// chat implementation manages — this module doesn't know or care where it
// comes from.
// ============================================================================

/**
 * Runs the AI ↔ tool loop: sends `messages` + `tools` to OpenAI, executes
 * any tool the model calls against your own `execute` implementations, and
 * returns the model's final text reply once no more tools are requested.
 *
 * Never throws — check `result.ok`. If a tool fails (unknown tool, invalid
 * arguments, or a thrown error during execution), the loop stops
 * immediately and `result.error` will have a `TOOL_*` code and `toolName`.
 */
export async function runWithToolsAction(
  options: RunWithToolsOptions
): Promise<AIActionResult<RunWithToolsResult>> {
  try {
    const data = await runWithTools(options);
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: toAIError(err) };
  }
}
