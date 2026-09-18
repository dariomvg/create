"use server";

/**
 * Server Actions for the Vercel AI SDK Tool Calling module.
 * Import directly into Server Components or Client Components — no
 * streaming here, so no separate client.ts is needed.
 *
 * Requires at least one tool to be registered via tools.ts's
 * registerTool()/registerTools() during app startup.
 */

import { runWithToolsService } from "./service";
import type { RunWithToolsParams, RunWithToolsResult, AIResult } from "./types";

/**
 * Runs a prompt with the registered tools available to the model. The
 * model may call one or more tools (up to TOOL_LOOP_CONFIG.maxSteps
 * rounds) before producing its final text response.
 */
export async function runWithTools(
  params: RunWithToolsParams
): Promise<AIResult<RunWithToolsResult>> {
  return runWithToolsService(params);
}
