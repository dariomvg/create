import pc from 'picocolors';
import type { ModuleContext, ResolvedSelection } from './types.js';
import { copySelection, createTouchedProvidersSet } from './copy-files.js';
import { installDeps } from './install-deps.js';
import { syncEnvExample } from './env.js';
import { log } from './logger.js';

/**
 * El flujo genérico que corre para UNA ResolvedSelection. module.ts de
 * cada módulo solo decide qué features/providers existen — la
 * secuencia de pasos acá es siempre la misma, sin importar si es
 * resend, stripe o auth/clerk/basic-auth.
 *
 * Ya no hay injectMiddleware(): proxy.ts dejó de fusionarse por
 * marcadores (ver rise-cli-guia.md, corrección de la sección 4b) — se
 * copia como archivo normal dentro de copySelection(), con su propio
 * confirm() si ya existe. No queda ningún paso extra que disparar acá.
 *
 * Devuelve true/false en vez de relanzar el error: así runProviders()
 * puede seguir con el resto de la selección del usuario aunque una
 * falle, en vez de cortar toda la corrida del CLI.
 */
async function runSelection(
  resolved: ResolvedSelection,
  ctx: ModuleContext,
  touched: Set<string>,
): Promise<boolean> {
  const { selection, provider } = resolved;
  const support = provider.features.find((f) => f.featureId === selection.featureId)!;

  log.step(pc.bold(`${provider.name} — ${selection.featureId}`));

  try {
    const { firstTouch } = await copySelection(selection, provider, ctx, touched);

    // Deps base del provider solo se instalan la primera vez que se
    // toca (moduleId, providerId) en la corrida — igual que common/.
    // Las de la feature (support.dependencies) se instalan siempre,
    // una por cada Selection procesada.
    const deps = [...(firstTouch ? provider.dependencies : []), ...(support.dependencies ?? [])];
    if (deps.length > 0) {
      await installDeps(deps, ctx);
    }

    await syncEnvExample(selection, provider, ctx);

    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error(`Failed to configure ${provider.name} (${selection.featureId}): ${message}`);
    return false;
  }
}

/**
 * Corre runSelection() para una lista de ResolvedSelection, UNA POR
 * UNA — a propósito, no en paralelo. Instalar dependencias en
 * simultáneo sobre el mismo package.json/lockfile puede pisarse entre
 * sí y corromper el archivo. Es más lento, pero seguro.
 *
 * El "touched" set se crea UNA sola vez acá y se pasa a cada
 * runSelection(), así common/ y las deps base de un provider no se
 * repiten aunque el usuario haya elegido varias features del mismo
 * (moduleId, providerId).
 *
 * Devuelve solo las Selection que terminaron OK — summary.ts usa esta
 * lista para saber de cuáles buscar el SETUP.md al final (no tiene
 * sentido mostrar instrucciones de algo que falló a mitad de camino).
 */
export async function runProviders(
  selections: ResolvedSelection[],
  ctx: ModuleContext,
): Promise<ResolvedSelection[]> {
  const touched = createTouchedProvidersSet();
  const succeeded: ResolvedSelection[] = [];

  for (const resolved of selections) {
    const ok = await runSelection(resolved, ctx, touched);
    if (ok) succeeded.push(resolved);
  }

  return succeeded;
}