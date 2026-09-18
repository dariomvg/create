import path from 'node:path';
import pc from 'picocolors';
import type { ModuleContext, ResolvedSelection } from './types.js';
import { outro } from './logger.js';
import { featurePath } from '../utils/paths.js';
import { pathExists } from '../utils/fs.js';

const SETUP_FILE = 'SETUP.md';

// TODO: confirmar la URL final (¿formaui.site sigue siendo el sitio
// de referencia para Rise, o cambia con el rebrand a @dariomvg/create?)
const MORE_INFO_URL = 'https://www.formaui.site';

/**
 * Se llama UNA vez al final de todo el flujo, con la lista de
 * ResolvedSelection que runProviders() (archivo anterior) devolvió
 * como exitosas. Las que fallaron ya se logueron individualmente en su
 * momento (runSelection las marca con log.error) — acá no hace falta
 * repetirlas.
 *
 * A diferencia de FormaUI (que leía provider.setupFile, un campo
 * estático), acá el SETUP.md se busca por convención de ruta:
 * lib/<moduleId>/<providerId>/<featureId>/SETUP.md — porque ahora el
 * setup relevante es por feature, no por provider entero (ver
 * types.ts, donde se sacó setupFile de FormaProvider).
 */
export async function printSummary(
  succeeded: ResolvedSelection[],
  ctx: ModuleContext,
): Promise<void> {
  if (succeeded.length === 0) {
    outro('No configuration was applied. Please check the errors above.');
    return;
  }

  const setupFiles = await collectSetupFiles(succeeded, ctx);
  const visitLine = pc.blue(`Visit ${MORE_INFO_URL} for more information.`);
  const thanksLine = '✨Thanks, and happy building!✨';
  const footer = `\n\n${visitLine}\n${thanksLine}`;

  if (setupFiles.length === 0) {
    outro(`Ready! All configured without pending manual steps.${footer}`);
    return;
  }

  const heading = pc.magenta('Ready! Before starting, review these files:');
  const list = setupFiles.map((file) => `  ${pc.magenta('→')} ${pc.magenta(file)}`).join('\n');
  outro(`${heading}\n\n${list}${footer}`);
}

async function collectSetupFiles(
  succeeded: ResolvedSelection[],
  ctx: ModuleContext,
): Promise<string[]> {
  const files: string[] = [];

  for (const { selection } of succeeded) {
    const dir = featurePath(ctx, selection.moduleId, selection.providerId, selection.featureId);
    const setupPath = path.join(dir, SETUP_FILE);

    if (await pathExists(setupPath)) {
      files.push(path.relative(ctx.projectRoot, setupPath));
    }
  }

  // Puede haber SETUP.md repetidos si dos features distintas del mismo
  // provider apuntaran, por error de template, al mismo archivo — de
  // más está, pero previene una lista con duplicados visibles al usuario.
  return [...new Set(files)];
}