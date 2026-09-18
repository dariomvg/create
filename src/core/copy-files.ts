import path from 'node:path';
import type { FormaProvider, ModuleContext, RouteDef, Selection } from './types.js';
import { featurePath, libPath, proxyPath, toProjectPath } from '../utils/paths.js';
import { copyDir, copyFile, pathExists } from '../utils/fs.js';
import { confirm, log } from './logger.js';

/**
 * Nombre fijo del archivo de proxy. Sin middleware.ts — Rise apunta a
 * Next.js 16+, que lo renombró a proxy.ts.
 */
const PROXY_FILE = 'proxy.ts';

/**
 * '.env.example' se excluye SIEMPRE del copiado normal (tanto de
 * common/ como de cualquier <featureId>/): lo maneja env.ts (sync hacia
 * .env.local), no copy-files.ts. proxy.ts también se excluye del
 * copiado normal porque tiene su propio destino fijo (ver
 * copyProxyIfPresent) — no termina en lib/, va a la raíz del proyecto.
 */
const ALWAYS_EXCLUDED_FROM_LIB = new Set(['.env.example', PROXY_FILE]);

/**
 * Claves ya "tocadas" en esta corrida del CLI, para no volver a copiar
 * common/ dos veces si el usuario elige más de una feature del mismo
 * (moduleId, providerId). Vive en el módulo (no dentro de la función)
 * a propósito: index.ts/run-provider.ts importa este mismo Set y lo va
 * pasando entre llamadas a copySelection() durante toda la corrida.
 */
export function createTouchedProvidersSet(): Set<string> {
  return new Set<string>();
}

function touchedKey(moduleId: string, providerId: string): string {
  return `${moduleId}:${providerId}`;
}

/**
 * El motor de copiado para UNA Selection ya resuelta contra su
 * FormaProvider. En orden (ver rise-cli-guia.md, sección 6):
 *   1. common/ → lib/<moduleId>/<providerId>/ (solo la primera vez que
 *      se toca este módulo+provider en la corrida)
 *   2. <featureId>/ → lib/<moduleId>/<providerId>/<featureId>/
 *   3. proxy.ts, si el provider lo trae en common/ → raíz del proyecto
 *      (archivo normal, overwrite con confirm — sin merge, ver nota en
 *      types.ts)
 *   4. rutas explícitas de esta feature (FeatureSupport.routes)
 *
 * .env.example queda afuera de acá a propósito: lo sincroniza env.ts,
 * llamado aparte por run-provider.ts.
 *
 * Devuelve { firstTouch }: true si esta llamada fue la que copió
 * common/ (primera vez que se toca este módulo+provider en la corrida).
 * run-provider.ts lo usa para decidir si instala también las deps BASE
 * del provider, o solo las extra de esta feature.
 */
export async function copySelection(
  selection: Selection,
  provider: FormaProvider,
  ctx: ModuleContext,
  touched: Set<string>,
): Promise<{ firstTouch: boolean }> {
  const { moduleId, featureId } = selection;

  const support = provider.features.find((f) => f.featureId === featureId);
  if (!support) {
    throw new Error(
      `Provider "${provider.id}" does not declare support for feature "${featureId}"`,
    );
  }

  const key = touchedKey(moduleId, provider.id);
  const firstTouch = !touched.has(key);

  if (firstTouch) {
    await copyCommon(moduleId, provider, ctx);
    await copyProxyIfPresent(moduleId, provider, ctx);
    touched.add(key);
  }

  await copyFeature(moduleId, featureId, provider, ctx, support.routes ?? []);

  for (const route of support.routes ?? []) {
    await copyRoute(provider, route, ctx);
  }

  return { firstTouch };
}

async function copyCommon(
  moduleId: string,
  provider: FormaProvider,
  ctx: ModuleContext,
): Promise<void> {
  const from = path.join(provider.templateDir, 'common');
  if (!(await pathExists(from))) return; // un provider puede no tener common/

  const to = libPath(ctx, moduleId, provider.id);
  await copyDirWithConfirm(from, to, `lib/${moduleId}/${provider.id}/`, ALWAYS_EXCLUDED_FROM_LIB);
}

/**
 * Copia los archivos "normales" de la feature a lib/, EXCLUYENDO los
 * que tengan ruta explícita en "routes" — esos los copia copyRoute()
 * aparte, a su destino real. Sin esta exclusión, un route.ts (el
 * webhook de Clerk, el callback de Supabase) terminaría copiado DOS
 * veces: una vez a su ruta real y otra sin querer dentro de
 * lib/<moduleId>/<providerId>/<featureId>/.
 *
 * route.from viene relativo a templateDir (ej: 'basic-auth/route.ts'),
 * pero acá necesitamos la ruta relativa a la carpeta de LA FEATURE (ej:
 * 'route.ts') — por eso el path.relative(featureId, route.from).
 */
async function copyFeature(
  moduleId: string,
  featureId: string,
  provider: FormaProvider,
  ctx: ModuleContext,
  routes: RouteDef[],
): Promise<void> {
  const from = path.join(provider.templateDir, featureId);
  if (!(await pathExists(from))) return; // la feature puede no traer archivos "normales" propios

  const excluded = new Set([
    ...routes.map((route) => path.relative(featureId, route.from)),
    ...ALWAYS_EXCLUDED_FROM_LIB,
  ]);

  const to = featurePath(ctx, moduleId, provider.id, featureId);
  await copyDirWithConfirm(from, to, `lib/${moduleId}/${provider.id}/${featureId}/`, excluded);
}

/**
 * proxy.ts se busca solo en common/ (no por feature): al no haber merge
 * por marcadores, un solo archivo por provider es lo que tiene sentido
 * — si más adelante algún provider necesita variarlo por feature,
 * conviene resolverlo cuando aparezca el caso real, no antes.
 *
 * Usa su propio mensaje de confirm (no copyFileWithConfirm genérico):
 * proxy.ts es el único archivo real del proyecto (Next.js no soporta
 * más de uno), así que si ya existe casi siempre significa "ya
 * configuraste otro provider de auth antes" — el mensaje genérico
 * ("already exists. Overwrite it?") no deja claro que sobreescribir acá
 * implica perder la lógica de sesión del provider anterior, no solo un
 * archivo cualquiera.
 */
async function copyProxyIfPresent(
  moduleId: string,
  provider: FormaProvider,
  ctx: ModuleContext,
): Promise<void> {
  const from = path.join(provider.templateDir, 'common', PROXY_FILE);
  if (!(await pathExists(from))) return;

  const to = proxyPath(ctx);

  if (await pathExists(to)) {
    const overwrite = await confirm(
      `proxy.ts already exists — it was likely generated for a different auth provider. ` +
        `Next.js only supports one proxy.ts, so overwriting it with ${provider.name}'s version ` +
        `will replace that provider's session/auth logic entirely. Overwrite?`,
    );
    if (!overwrite) {
      log.warn(`Skipped proxy.ts — ${provider.name} may not work correctly without it.`);
      return;
    }
  }

  await copyFile(from, to);
  log.success('File created: proxy.ts');
}

async function copyRoute(
  provider: FormaProvider,
  route: { from: string; to: string },
  ctx: ModuleContext,
): Promise<void> {
  const from = path.join(provider.templateDir, route.from);
  const to = toProjectPath(ctx, route.to);
  await copyFileWithConfirm(from, to, route.to);
}

/**
 * Copia una carpeta entera, preguntando confirm() si el destino ya
 * existe. No hay merge: si el usuario confirma, se sobreescribe todo el
 * contenido; si no, se omite completo.
 */
async function copyDirWithConfirm(
  from: string,
  to: string,
  label: string,
  exclude: Set<string>,
): Promise<void> {
  if (await pathExists(to)) {
    const overwrite = await confirm(`${label} already exists. Overwrite its contents?`);
    if (!overwrite) {
      log.warn(`Skipped ${label}`);
      return;
    }
  }

  await copyDir(from, to, exclude);
  log.success(`Files copied to ${label}`);
}

/**
 * Igual que copyDirWithConfirm pero para un único archivo (proxy.ts,
 * route.ts). Usado tanto para proxy.ts como para las "routes"
 * explícitas de una feature.
 */
async function copyFileWithConfirm(from: string, to: string, label: string): Promise<void> {
  if (await pathExists(to)) {
    const overwrite = await confirm(`${label} already exists. Overwrite it?`);
    if (!overwrite) {
      log.warn(`Skipped ${label}`);
      return;
    }
  }

  await copyFile(from, to);
  log.success(`File created: ${label}`);
}