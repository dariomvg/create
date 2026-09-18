import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Command } from 'commander';

/**
 * Lee la versión desde el package.json del PROPIO CLI (no el del
 * proyecto destino) para que --version siempre muestre la real, sin
 * tener que acordarse de actualizar un string hardcodeado acá cada vez
 * que se hace `npm version`.
 *
 * Se resuelve con import.meta.url en vez de un path fijo porque este
 * archivo termina compilado en dist/index.js — desde ahí, '..' apunta
 * a la raíz del paquete (donde vive el package.json real).
 */
function readCliVersion(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const pkgPath = path.join(here, '..', 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
  return pkg.version;
}

/**
 * Arma el programa de commander. Recibe onRun como parámetro (en vez de
 * importar el flujo principal directo) para evitar un import circular:
 * index.ts va a importar createProgram() de acá, y le va a pasar SU
 * PROPIA función de flujo — cli.ts nunca necesita saber qué hace esa
 * función, solo que existe y hay que llamarla.
 */
export function createProgram(onRun: () => Promise<void>): Command {
  const program = new Command();

  program
    .name('create')
    .description('Add: Auth - AI - Payments - Email to Next.js projects')
    .version(readCliVersion());

  // Por ahora hay un solo flujo (el interactivo). Más adelante se
  // podrían sumar subcomandos tipo `create add email` acá mismo, sin
  // tocar el resto del CLI.
  program.action(async () => {
    await onRun();
  });

  return program;
}