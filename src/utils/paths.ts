import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Raíz real del paquete del CLI (donde vive package.json), calculada
 * UNA sola vez cuando este módulo carga. Funciona igual antes y después
 * de que tsup bundlee todo en dist/index.js: como este archivo termina
 * dentro de ese mismo bundle, import.meta.url apunta a dist/index.js,
 * y un solo '..' desde ahí llega a la raíz del paquete — sea corriendo
 * local vía npm link o ya publicado en npm.
 */
const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Arma la ruta absoluta a templates/<providerId>/ de un módulo, sin que
 * cada provider.ts tenga que calcularla por su cuenta (ver comentario
 * de arriba sobre por qué import.meta.url por archivo NO funciona acá).
 *
 * Ejemplo: resolveTemplateDir('email', 'resend')
 *   → <raíz del paquete>/src/modules/email/templates/resend
 */
export function resolveTemplateDir(moduleId: string, providerId: string): string {
  return path.join(packageRoot, 'src', 'modules', moduleId, 'templates', providerId);
}

/**
 * Esto es un subconjunto de ModuleContext (que vamos a definir en
 * core/types.ts). Se declara acá, chico y propio, para que paths.ts no
 * dependa de types.ts — evita import circular y deja este archivo
 * usable desde cualquier lado sin arrastrar el resto del core.
 */
export interface PathContext {
  projectRoot: string;
  srcDir: boolean; // true si el proyecto usa carpeta src/, false si no
}

/**
 * Toma una ruta relativa "de manual" (ej: 'lib/auth/clerk', 'app/api/webhooks/stripe/route.ts')
 * y la resuelve a la ruta real en el proyecto del usuario, agregando 'src/'
 * en el medio SOLO si el proyecto lo usa.
 *
 * Esta es la función que centraliza la pregunta "¿esto va en app/ o en
 * src/app/?" para que ningún otro archivo del CLI tenga que resolverla
 * por su cuenta.
 *
 * Ejemplos:
 *   toProjectPath({ projectRoot: '/x', srcDir: false }, 'lib/auth/clerk')
 *     → /x/lib/auth/clerk
 *   toProjectPath({ projectRoot: '/x', srcDir: true }, 'lib/auth/clerk')
 *     → /x/src/lib/auth/clerk
 */
export function toProjectPath(ctx: PathContext, relativePath: string): string {
  const base = ctx.srcDir ? path.join(ctx.projectRoot, 'src') : ctx.projectRoot;
  return path.join(base, relativePath);
}

/**
 * Ruta destino para el contenido de common/ y para los archivos
 * "normales" de un (módulo, provider): lib/<moduleId>/<providerId>/.
 *
 * Este es el cambio grande respecto a FormaUI: ahí era solo
 * lib/<providerId>/, sin el nivel de módulo. Acá hace falta porque un
 * mismo providerId puede repetirse entre módulos distintos, y porque
 * una misma feature puede terminar instalada con más de un provider
 * (ver rise-cli-guia.md, sección 4a).
 *
 * Ejemplo: libPath(ctx, 'auth', 'clerk') → .../lib/auth/clerk
 *          (o .../src/lib/auth/clerk si el proyecto usa src/)
 */
export function libPath(ctx: PathContext, moduleId: string, providerId: string): string {
  return toProjectPath(ctx, path.join('lib', moduleId, providerId));
}

/**
 * Ruta destino para los archivos normales de UNA feature puntual dentro
 * de un (módulo, provider): lib/<moduleId>/<providerId>/<featureId>/.
 *
 * Ejemplo: featurePath(ctx, 'auth', 'clerk', 'basic-auth')
 *   → .../lib/auth/clerk/basic-auth
 */
export function featurePath(
  ctx: PathContext,
  moduleId: string,
  providerId: string,
  featureId: string,
): string {
  return path.join(libPath(ctx, moduleId, providerId), featureId);
}

/**
 * proxy.ts es un caso especial de Next.js (reemplazo de middleware.ts
 * desde Next.js 16 — Rise ya no genera middleware.ts, solo proxy.ts):
 * siempre vive en la raíz "efectiva" del proyecto (dentro de src/ si el
 * proyecto usa src/, pero NUNCA dentro de lib/ ni de app/).
 *
 * A diferencia de los archivos normales, este es UN SOLO archivo real
 * para todo el proyecto — Next.js no soporta más de un proxy.ts. Si
 * varias features (de uno o más módulos/providers) necesitan aportar su
 * bloque, todas se fusionan acá vía merge-shared-file.ts, con marcadores
 * // [rise:<moduleId>:<providerId>:<featureId>:start]/[end] — se incluye
 * moduleId y providerId en el marcador (no solo featureId) justamente
 * para que dos providers que soportan la misma feature (ej. basic-auth
 * en Clerk y en Supabase) no se pisen el bloque entre sí.
 */
export function proxyPath(ctx: PathContext): string {
  return toProjectPath(ctx, 'proxy.ts');
}

/**
 * .env.local es distinto a todo lo anterior: SIEMPRE va en la raíz real
 * del repo (projectRoot), nunca dentro de src/, tenga el proyecto src/ o no.
 * Por eso NO usa toProjectPath acá — sería un error meterlo en src/.
 */
export function envLocalPath(ctx: PathContext): string {
  return path.join(ctx.projectRoot, '.env.local');
}

/**
 * Carpeta dentro del paquete del CLI donde viven las plantillas de los
 * archivos de instrucciones para IA (AGENTS.md, CLAUDE.md, GEMINI.md).
 * Van bajo src/ por la misma razón que los templates de módulos: se
 * publican como archivos crudos (ver "files" en package.json), no los
 * bundlea tsup.
 */
export function resolveAgentDocsDir(): string {
  return path.join(packageRoot, 'src', 'agent-docs');
}

/**
 * Destino de AGENTS.md / CLAUDE.md / GEMINI.md: SIEMPRE la raíz real
 * del repo, nunca src/. Las herramientas de IA los buscan ahí, igual
 * que pasa con .env.local — por eso NO usa toProjectPath.
 */
export function agentDocPath(ctx: PathContext, fileName: string): string {
  return path.join(ctx.projectRoot, fileName);
}