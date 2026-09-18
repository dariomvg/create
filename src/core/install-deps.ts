import { execa } from 'execa';
import type { ModuleContext } from './types.js';
import { installCommand } from './detect-package-manager.js';
import { readPackageJson, filterNewDependencies } from '../utils/package-json.js';
import { startSpinner, log } from './logger.js';

/**
 * Instala una lista de dependencias en el proyecto destino, usando el
 * package manager que ya detectamos (ctx.packageManager). Antes de
 * instalar, filtra las que el usuario ya tiene — así el comando real
 * que corre execa nunca incluye paquetes de más.
 */
export async function installDeps(deps: string[], ctx: ModuleContext): Promise<void> {
  if (deps.length === 0) return;

  const pkg = await readPackageJson(ctx.projectRoot);
  const newDeps = pkg ? filterNewDependencies(pkg, deps) : deps;

  if (newDeps.length === 0) {
    log.info('All dependencies were already installed.');
    return;
  }

  const { command, args } = installCommand(ctx.packageManager, newDeps);
  const spinner = startSpinner(`Installing ${newDeps.join(', ')}...`);

  try {
    await execa(command, args, { cwd: ctx.projectRoot });
    spinner.stop(`Dependencies installed: ${newDeps.join(', ')}`);
  } catch (error) {
    spinner.stop('Failed to install dependencies.');
    // No se silencia el error acá: se relanza para que quien orquesta
    // (run-provider.ts) decida cómo reaccionar — por ejemplo, avisar
    // que ESTE provider falló sin cortar los demás que el usuario haya
    // elegido en la misma corrida.
    throw error;
  }
}