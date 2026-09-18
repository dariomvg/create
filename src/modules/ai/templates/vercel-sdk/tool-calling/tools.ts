/**
 * Tool registry for the Vercel AI SDK Tool Calling module.
 *
 * This module ships no tools of its own. Define each ToolDefinition
 * (see types.ts) — name, description, Zod parameters, and an execute
 * function that calls your Database/API — and register it once during
 * app startup:
 *
 *   import { registerTool } from "@/lib/ai-tools/tools";
 *   registerTool(myGetOrderStatusTool);
 *
 * service.ts reads the registered tools through getTools() and returns a
 * clear error if a requested tool name isn't registered.
 */

import type { AIResult, ToolDefinition } from "./types";

const toolRegistry = new Map<string, ToolDefinition>();

/** Registers a single tool. Call during app startup, before any run. */
export function registerTool(tool: ToolDefinition): void {
  toolRegistry.set(tool.name, tool);
}

/** Registers multiple tools at once. */
export function registerTools(tools: ToolDefinition[]): void {
  for (const tool of tools) registerTool(tool);
}

/** Returns every registered tool. */
export function getAllTools(): ToolDefinition[] {
  return Array.from(toolRegistry.values());
}

/**
 * Returns the tools for the given names, or every registered tool if
 * `names` is omitted. Fails with INVALID_REQUEST if any requested name
 * isn't registered, instead of silently dropping it.
 */
export function getTools(names?: string[]): AIResult<ToolDefinition[]> {
  if (!names) {
    return { success: true, data: getAllTools() };
  }

  const tools: ToolDefinition[] = [];
  const missing: string[] = [];

  for (const name of names) {
    const tool = toolRegistry.get(name);
    if (tool) {
      tools.push(tool);
    } else {
      missing.push(name);
    }
  }

  if (missing.length > 0) {
    return {
      success: false,
      error: {
        code: "INVALID_REQUEST",
        message: `Unknown tool(s): ${missing.join(", ")}`,
      },
    };
  }

  return { success: true, data: tools };
}
