import path from 'node:path';
import type { Copyable, ModuleContext } from './types.js';
import { middlewarePath } from '../utils/paths.js';
import { pathExists, readFile, writeFile } from '../utils/fs.js';
import { confirm, log } from './logger.js';

const markerStart = (id: string) => `// [formaui:${id}:start]`;
const markerEnd = (id: string) => `// [formaui:${id}:end]`;

/**
 * Solo lo llama runProvider() (Bloque 4, próximo archivo) cuando el
 * provider tiene needsMiddleware: true. Convención fija: en ese caso,
 * el contenido de middleware vive en templateDir/middleware.ts — no
 * pasa por lib/ ni por "routes", porque necesita lógica de merge
 * distinta a un copiado simple.
 *
 * Tres escenarios posibles:
 *   1. No existe middleware.ts todavía → se crea desde cero.
 *   2. Existe y ya tiene el bloque de ESTE provider → se reemplaza solo
 *      ese bloque (permite correr el CLI de nuevo sin duplicar nada).
 *   3. Existe pero sin el bloque de este provider → se pregunta antes
 *      de agregar, porque puede haber un "matcher" que necesite
 *      revisión manual para no chocar con lo existente.
 */
export async function injectMiddleware(item: Copyable, ctx: ModuleContext): Promise<void> {
  const sourceFile = path.join(item.templateDir, 'middleware.ts');
  const targetFile = middlewarePath(ctx);

  const content = await readFile(sourceFile);
  const block = `${markerStart(item.id)}\n${content.trim()}\n${markerEnd(item.id)}`;

  if (!(await pathExists(targetFile))) {
    await writeFile(targetFile, `${block}\n`);
    log.success(`middleware.ts creado con la lógica de ${item.id}.`);
    return;
  }

  const current = await readFile(targetFile);

  if (current.includes(markerStart(item.id))) {
    const updated = replaceBlock(current, item.id, block);
    await writeFile(targetFile, updated);
    log.success(`middleware.ts updated (block of ${item.id}).`);
    return;
  }

  const proceed = await confirm(
    `It already exists middleware.ts. ¿Add the logic of ${item.id} there?`,
  );

  if (!proceed) {
    log.warn(
      `The integration of ${item.id} in middleware.ts was omitted. The block remains documented in its _setup.ts.`,
    );
    return;
  }

  const updated = `${current.trimEnd()}\n\n${block}\n`;
  await writeFile(targetFile, updated);
  log.success(`middleware.ts updated (block of ${item.id} added).`);
}

/**
 * Reemplaza SOLO el bloque delimitado por los marcadores de este
 * provider, dejando intacto todo lo demás en el archivo (bloques de
 * otros providers, o código que el usuario haya agregado a mano fuera
 * de los marcadores).
 */
function replaceBlock(current: string, id: string, newBlock: string): string {
  const pattern = new RegExp(
    `${escapeRegExp(markerStart(id))}[\\s\\S]*?${escapeRegExp(markerEnd(id))}`,
  );
  return current.replace(pattern, newBlock);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}