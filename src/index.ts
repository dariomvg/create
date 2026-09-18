import type { ModuleContext } from './core/types.js';
import { createProgram } from './cli.js';
import { intro, log } from './core/logger.js';
import { detectProject } from './core/detect-project.js';
import { detectPackageManager } from './core/detect-package-manager.js';
import { runMainMenu } from './prompts/main-menu.js';
import { runProviders } from './core/run-provider.js';
import { printSummary } from './core/summary.js';

/**
 * El flujo completo, de punta a punta. Esta función es lo que
 * cli.ts (createProgram) dispara cuando se corre `create` sin
 * argumentos — es el "main real" del CLI.
 */
async function main(): Promise<void> {
  intro('Dariomvg — CLI', 'Add Auth · AI · Payments · Email to your Next.js project');

  const project = await detectProject();

  if (!project.isNextProject) {
    log.error('This doesn\'t look like a Next.js project (“next” was not found in package.json).');
    process.exitCode = 1;
    return;
  }

  const packageManager = await detectPackageManager(project.projectRoot);

  // project ya tiene projectRoot y srcDir (entre otros campos) porque
  // ModuleContext extiende ProjectInfo — por eso alcanza con "spread" +
  // agregar packageManager, sin mapear campo por campo.
  const ctx: ModuleContext = { ...project, packageManager };

  // runMainMenu() devuelve ResolvedSelection[] (no FormaProvider[] como
  // en FormaUI): cada elección ya trae su Selection (moduleId/featureId/
  // providerId) junto al FormaProvider concreto — ver core/types.ts.
  const selections = await runMainMenu();

  if (selections.length === 0) {
    log.warn('No features selected. Nothing to do.');
    return;
  }

  const succeeded = await runProviders(selections, ctx);
  await printSummary(succeeded, ctx);
}

// parseAsync() (no parse()) porque la acción del programa es async y
// necesitamos poder esperarla y atrapar cualquier error inesperado acá,
// en vez de que Node lo muestre como un stack trace crudo al usuario.
createProgram(main)
  .parseAsync()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    log.error(`Unexpected error: ${message}`);
    process.exitCode = 1;
  });