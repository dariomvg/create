/**
 * Tool registry.
 *
 * This is the file you edit. Register each tool here with its schema and
 * execution logic (hit your database, call an external API, etc.).
 * service.ts only ever reads from this registry — it has no knowledge of
 * what any individual tool does.
 *
 * @example
 * registerTool({
 *   definition: {
 *     name: "get_weather",
 *     description: "Get the current weather for a city",
 *     input_schema: {
 *       type: "object",
 *       properties: {
 *         city: { type: "string", description: "City name" },
 *       },
 *       required: ["city"],
 *     },
 *   },
 *   execute: async (input: { city: string }) => {
 *     const res = await fetch(`https://api.example.com/weather?city=${input.city}`);
 *     return res.json();
 *   },
 * });
 */

import type { Tool } from "./types";

const registry = new Map<string, Tool>();

/** Registers a tool. Call this once per tool, e.g. at the bottom of this file. */
export function registerTool(tool: Tool): void {
  registry.set(tool.definition.name, tool);
}

/** Returns a registered tool by name, or undefined if it isn't registered. */
export function getTool(name: string): Tool | undefined {
  return registry.get(name);
}

/** Returns every registered tool's definition, ready to send to the API. */
export function listToolDefinitions() {
  return Array.from(registry.values()).map((tool) => tool.definition);
}

// ---------------------------------------------------------------------------
// Register your tools below
// ---------------------------------------------------------------------------
