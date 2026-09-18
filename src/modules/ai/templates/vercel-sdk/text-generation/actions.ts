"use server";

/**
 * Server Actions for the Vercel AI SDK Text Generation module.
 * Import these directly into Server Components or other server-side code.
 *
 * Streaming is not exposed here — Server Actions can't return a native
 * ReadableStream. Use the route handler in stream/route.ts (via client.ts
 * on the client side) for streaming instead.
 */

import {
  generateTextService,
  generateStructuredService,
} from "./service";
import type {
  GenerateTextParams,
  GenerateTextResult,
  GenerateStructuredParams,
  GenerateStructuredResult,
  AIResult,
} from "./types";

/**
 * Generates a complete text response for the given prompt.
 * Returns a normalized AIResult — check `result.success` before use.
 */
export async function generateText(
  params: GenerateTextParams
): Promise<AIResult<GenerateTextResult>> {
  return generateTextService(params);
}

/**
 * Generates a structured object matching the provided Zod schema.
 * Returns a normalized AIResult — check `result.success` before use.
 */
export async function generateStructuredOutput<T>(
  params: GenerateStructuredParams<T>
): Promise<AIResult<GenerateStructuredResult<T>>> {
  return generateStructuredService(params);
}
