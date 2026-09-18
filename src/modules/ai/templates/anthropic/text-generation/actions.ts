"use server";

/**
 * Server Actions for the Anthropic Text Generation module.
 *
 * These are the functions meant to be imported directly into server
 * components. Streaming is not available here — Server Actions cannot
 * return a native ReadableStream. Use client.ts + the /stream route
 * for streaming from client components.
 */

import {
  generateTextService,
  generateStructuredOutputService,
} from "./service";
import type {
  AIResult,
  GenerationOptions,
  GenerateTextResult,
  StructuredOutputOptions,
  GenerateStructuredOutputResult,
} from "./types";

/**
 * Generates a complete text response for the given prompt.
 *
 * @example
 * const result = await generateText("Explain quantum computing simply");
 * if (result.error) {
 *   // render result.error.message in the UI
 * } else {
 *   console.log(result.data.text);
 * }
 */
export async function generateText(
  prompt: string,
  options?: GenerationOptions
): Promise<AIResult<GenerateTextResult>> {
  return generateTextService(prompt, options);
}

/**
 * Generates a structured object matching the provided JSON schema.
 *
 * @example
 * const result = await generateStructuredOutput(
 *   "Extract the name and age from: John is 30 years old",
 *   {
 *     schemaName: "extract_person",
 *     schema: {
 *       type: "object",
 *       properties: {
 *         name: { type: "string" },
 *         age: { type: "number" },
 *       },
 *       required: ["name", "age"],
 *     },
 *   }
 * );
 */
export async function generateStructuredOutput<T = unknown>(
  prompt: string,
  options: StructuredOutputOptions
): Promise<AIResult<GenerateStructuredOutputResult<T>>> {
  return generateStructuredOutputService<T>(prompt, options);
}
