import type { ToolDefinition } from "./types";

// ============================================================================
// OpenAI Tool Calling — Tool registry
// This is the file you customize: define your own tools here (or wherever
// you prefer) using `defineTool`, then pass them as the `tools` array to
// `runWithToolsAction`. Nothing else in this module needs to change.
// ============================================================================

/**
 * Thin identity helper — exists purely for type inference. Defining a tool
 * through this function lets TypeScript infer `TArgs`/`TResult` from
 * `parameters`/`execute` instead of having to annotate them by hand.
 *
 * Usage:
 *   const getWeather = defineTool({
 *     name: "get_weather",
 *     description: "Get the current weather for a city",
 *     parameters: {
 *       type: "object",
 *       properties: { city: { type: "string" } },
 *       required: ["city"],
 *       additionalProperties: false,
 *     },
 *     execute: async ({ city }: { city: string }) => {
 *       // Call your own weather API/DB here.
 *       return { city, tempCelsius: 21 };
 *     },
 *   });
 */
export function defineTool<TArgs = Record<string, unknown>, TResult = unknown>(
  tool: ToolDefinition<TArgs, TResult>
): ToolDefinition<TArgs, TResult> {
  return tool;
}

/**
 * Builds a name → tool lookup map for a given run, and rejects duplicate
 * tool names up front. Used internally by service.ts.
 */
export function createToolRegistry(tools: ToolDefinition[]): Map<string, ToolDefinition> {
  const registry = new Map<string, ToolDefinition>();

  for (const tool of tools) {
    if (registry.has(tool.name)) {
      throw new Error(`Duplicate tool name: "${tool.name}"`);
    }
    registry.set(tool.name, tool);
  }

  return registry;
}
