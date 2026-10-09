import path from 'node:path';
import type { ModuleContext } from './types.js';
import { agentDocPath, resolveAgentDocsDir } from '../utils/paths.js';
import { readFileIfExists, writeFile } from '../utils/fs.js';
import { log } from './logger.js';

/**
 * Archivos de instrucciones para IA que se copian a la raíz del
 * proyecto del usuario. AGENTS.md es el canónico; CLAUDE.md y
 * GEMINI.md son punteros chicos que lo referencian, para no duplicar
 * contenido.
 */
const AGENT_DOC_FILES = ['AGENTS.md', 'CLAUDE.md', 'GEMINI.md'] as const;

/**
 * Se llama UNA sola vez, al final de toda la corrida (no por
 * Selection): el contenido es el mismo sin importar qué módulos o
 * providers se hayan elegido, así que no tiene sentido repetirlo.
 *
 * Mismo criterio que env.ts con .env.example, pero para texto libre:
 *   - si el archivo no existe → se crea
 *   - si existe → se AGREGA el bloque al final, nunca se sobreescribe
 *   - si ya tiene el bloque de una corrida anterior → no se toca
 */
export async function copyAgentDocs(ctx: ModuleContext): Promise<void> {
  const sourceDir = resolveAgentDocsDir();

  for (const fileName of AGENT_DOC_FILES) {
    await syncAgentDoc(path.join(sourceDir, fileName), fileName, ctx);
  }
}

/**
 * Marcadores que envuelven el bloque que agrega el CLI. Sirven para dos
 * cosas: detectar que ya se agregó en una corrida anterior (idempotencia,
 * sin duplicar el contenido cada vez que se corre el CLI) y dejar claro
 * al usuario qué parte del archivo vino de @dariomvg/create. Son
 * comentarios HTML, invisibles al renderizar el Markdown.
 */
function markersFor(fileName: string): { start: string; end: string } {
  const id = fileName.replace(/\.md$/i, '').toLowerCase();
  return { start: `<!-- create:${id}:start -->`, end: `<!-- create:${id}:end -->` };
}

async function syncAgentDoc(sourcePath: string, fileName: string, ctx: ModuleContext): Promise<void> {
  const source = await readFileIfExists(sourcePath);
  if (source === null) {
    // No debería pasar (los archivos viajan en el paquete), pero un
    // template faltante no tiene por qué cortar el resto del flujo.
    log.warn(`Could not find the ${fileName} template. Skipped.`);
    return;
  }

  const target = agentDocPath(ctx, fileName);
  const existing = await readFileIfExists(target);
  const { start, end } = markersFor(fileName);

  if (existing !== null && existing.includes(start)) {
    log.info(`${fileName} already includes these instructions.`);
    return;
  }

  // CLAUDE.md y GEMINI.md son solo punteros a AGENTS.md: si el usuario
  // ya tenía uno que lo referencia (ej. su propio "@AGENTS.md"), agregar
  // el nuestro duplicaría el import sin aportar nada.
  if (fileName !== 'AGENTS.md' && existing !== null && existing.includes('AGENTS.md')) {
    log.info(`${fileName} already points to AGENTS.md.`);
    return;
  }

  const block = `${start}\n${source.trim()}\n${end}\n`;

  // Si el archivo ya tenía contenido, se deja una línea en blanco antes
  // del bloque para no pegarlo contra lo que el usuario ya escribió.
  const updated = existing !== null && existing.trim().length > 0
    ? `${existing.trimEnd()}\n\n${block}`
    : block;

  await writeFile(target, updated);
  log.success(existing === null ? `${fileName} created.` : `Instructions added to ${fileName}.`);
}
