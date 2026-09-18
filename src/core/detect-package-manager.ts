import path from 'node:path';
import { pathExists } from '../utils/fs.js';

export type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun';

/**
 * Cada package manager deja un lockfile con nombre propio. No hace falta
 * nada más sofisticado que buscar cuál existe — es la señal más confiable
 * (más que, por ejemplo, mirar variables de entorno).
 */
const LOCKFILES: Record<Exclude<PackageManager, 'npm'>, string> = {
  bun: 'bun.lockb',
  pnpm: 'pnpm-lock.yaml',
  yarn: 'yarn.lock',
};

/**
 * Devuelve qué package manager usa el proyecto destino. Si no encuentra
 * ningún lockfile conocido (proyecto recién creado, o que usa
 * package-lock.json de npm), cae en 'npm' por default — es el que
 * viene con Node siempre, así que es la apuesta más segura.
 */
export async function detectPackageManager(projectRoot: string): Promise<PackageManager> {
  if (await pathExists(path.join(projectRoot, LOCKFILES.bun))) return 'bun';
  if (await pathExists(path.join(projectRoot, LOCKFILES.pnpm))) return 'pnpm';
  if (await pathExists(path.join(projectRoot, LOCKFILES.yarn))) return 'yarn';
  return 'npm';
}

/**
 * Cada package manager usa un verbo distinto para instalar ("install" en
 * npm, "add" en los demás). Esto centraliza esa diferencia en un solo
 * lugar, para que install-deps.ts (Bloque 4) no tenga que saber nada de
 * sintaxis de comandos — solo le pasa el resultado a execa.
 */
export function installCommand(
  pm: PackageManager,
  deps: string[],
): { command: string; args: string[] } {
  switch (pm) {
    case 'npm':
      return { command: 'npm', args: ['install', ...deps] };
    case 'pnpm':
      return { command: 'pnpm', args: ['add', ...deps] };
    case 'yarn':
      return { command: 'yarn', args: ['add', ...deps] };
    case 'bun':
      return { command: 'bun', args: ['add', ...deps] };
  }
}