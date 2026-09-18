import path from 'node:path';
import type { FormaProvider, ModuleContext, Selection } from './types.js';
import { envLocalPath } from '../utils/paths.js';
import { readFileIfExists, writeFile } from '../utils/fs.js';
import { log } from './logger.js';

/**
 * Sincroniza los .env.example de una Selection contra el .env.local del
 * proyecto destino. Puede haber hasta TRES por Selection, cada uno
 * opcional (ver rise-cli-guia.md, sección 4c):
 *
 *   1. templates/<providerId>/.env.example         → provider-wide, sin
 *      necesitar carpeta common/. Es el caso típico de AI/payments/email:
 *      no hay código compartido entre features, solo credenciales base
 *      (ej: OPENAI_API_KEY), así que no hace falta pagar el costo extra
 *      de una carpeta common/ solo para esto.
 *   2. templates/<providerId>/common/.env.example   → provider-wide,
 *      DENTRO de common/. Pensado para casos como auth, donde common/
 *      ya existe igual por otros archivos compartidos (proxy.ts,
 *      service.ts) y tiene sentido que el env base viva ahí junto a
 *      ellos en vez de duplicar la ubicación.
 *   3. templates/<providerId>/<featureId>/.env.example → específico de
 *      esa feature puntual (ej: una feature que necesita una key extra
 *      que las demás no usan).
 *
 * Los tres se sincronizan exactamente igual, sin importar de cuál
 * vinieron. Es seguro que un provider use 1, 2 o los 3 a la vez — cada
 * llamada a syncOne() es independiente e idempotente.
 */
export async function syncEnvExample(
  selection: Selection,
  provider: FormaProvider,
  ctx: ModuleContext,
): Promise<void> {
  await syncOne(
    path.join(provider.templateDir, '.env.example'),
    `${provider.id}/.env.example`,
    ctx,
  );
  await syncOne(
    path.join(provider.templateDir, 'common', '.env.example'),
    `${provider.id}/common/.env.example`,
    ctx,
  );
  await syncOne(
    path.join(provider.templateDir, selection.featureId, '.env.example'),
    `${provider.id}/${selection.featureId}/.env.example`,
    ctx,
  );
}

/**
 * Sincroniza UN .env.example puntual contra .env.local. Es idempotente:
 * si una key ya existe en .env.local (con o sin valor cargado), NUNCA
 * se toca — evita pisar un secreto real que el usuario ya haya puesto a
 * mano. Si el archivo de origen no existe, no hace nada — no es un
 * error, simplemente no hay nada que sincronizar ahí (por ejemplo, una
 * feature que no agrega ninguna env var propia).
 */
async function syncOne(examplePath: string, label: string, ctx: ModuleContext): Promise<void> {
  const exampleContent = await readFileIfExists(examplePath);
  if (exampleContent === null) return;

  const target = envLocalPath(ctx);
  const existing = (await readFileIfExists(target)) ?? '';
  const existingKeys = extractKeys(existing);

  const missingBlock = extractMissingBlock(exampleContent, existingKeys);

  if (missingBlock === null) {
    log.info('The environment variables were already in .env.local.');
    return;
  }

  // Si el archivo ya tenía contenido, se deja una línea en blanco antes
  // del bloque nuevo para no pegar todo junto sin separación visual.
  const separator = existing.trim().length > 0 ? '\n\n' : '';
  const updated = `${existing.trimEnd()}${separator}${missingBlock}\n`;

  await writeFile(target, updated);
  log.success(`Variables added to .env.local (from ${label}).`);
}

/**
 * Recorre el .env.example línea por línea y arma el bloque a agregar,
 * conservando los comentarios que el propio archivo ya trae arriba de
 * cada key (no se inventa ninguna descripción nueva). Solo incluye las
 * keys que TODAVÍA no están en .env.local. Devuelve null si no hay
 * nada nuevo para agregar.
 */
function extractMissingBlock(exampleContent: string, existingKeys: Set<string>): string | null {
  const lines = exampleContent.split('\n');
  const output: string[] = [];
  let commentBuffer: string[] = [];
  let addedAny = false;

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    if (!trimmed) {
      // Línea en blanco: corta cualquier bloque de comentarios que
      // venía acumulando (no pertenece a la próxima key).
      commentBuffer = [];
      continue;
    }

    if (trimmed.startsWith('#')) {
      commentBuffer.push(line);
      continue;
    }

    const [rawKey] = trimmed.split('=');
    const key = rawKey?.trim();

    if (key && !existingKeys.has(key)) {
      output.push(...commentBuffer, line);
      addedAny = true;
    }

    commentBuffer = [];
  }

  return addedAny ? output.join('\n') : null;
}

/**
 * Extrae las keys ya presentes en un .env.local existente, ignorando
 * comentarios y líneas vacías. No valida el formato del valor —
 * solo necesitamos saber qué keys ya están declaradas.
 */
function extractKeys(content: string): Set<string> {
  const keys = new Set<string>();

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const [key] = trimmed.split('=');
    if (key) keys.add(key.trim());
  }

  return keys;
}