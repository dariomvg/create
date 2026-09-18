import fs from 'fs-extra';
import path from 'node:path';

/**
 * Wrapper fino sobre fs-extra. La idea de este archivo es que el resto
 * del CLI (copy-files.ts, env.ts, merge-shared-file.ts, etc.) nunca
 * importe 'fs-extra' directo — importa estas funciones, así si el día
 * de mañana cambiamos la librería de filesystem, se toca un solo lugar.
 *
 * A propósito, este archivo NO pregunta nada al usuario (no usa
 * @clack/prompts). Es solo I/O puro. Las confirmaciones ("¿sobreescribo
 * este archivo?") viven en copy-files.ts, que es quien conoce el
 * contexto de la operación.
 */

export async function pathExists(target: string): Promise<boolean> {
  return fs.pathExists(target);
}

export async function ensureDir(target: string): Promise<void> {
  await fs.ensureDir(target);
}

/**
 * Copia una carpeta entera de "from" a "to", tal cual, salvo los paths
 * relativos incluidos en "exclude" (usado por copy-files.ts para dejar
 * afuera los archivos que van a una ruta explícita vía "routes").
 */
export async function copyDir(
  from: string,
  to: string,
  exclude: Set<string> = new Set(),
): Promise<void> {
  await fs.copy(from, to, {
    filter: (src) => {
      if (src === from) return true; // la carpeta raíz siempre pasa
      const rel = path.relative(from, src);
      return !exclude.has(rel);
    },
  });
}

/**
 * Copia UN archivo puntual a una ruta destino, creando las carpetas
 * intermedias que hagan falta. Usado para las excepciones de "routes".
 */
export async function copyFile(from: string, to: string): Promise<void> {
  await ensureDir(path.dirname(to));
  await fs.copy(from, to);
}

/**
 * Lee un archivo de texto. Tira error si no existe — usar pathExists()
 * o readFileIfExists() antes si no estás seguro.
 */
export async function readFile(target: string): Promise<string> {
  return fs.readFile(target, 'utf-8');
}

/**
 * Igual que readFile, pero devuelve null en vez de tirar error si el
 * archivo no existe. Pensado para casos como env.ts, donde .env.local
 * puede no existir todavía y no es un error, es un caso normal.
 */
export async function readFileIfExists(target: string): Promise<string | null> {
  if (!(await pathExists(target))) return null;
  return readFile(target);
}

/**
 * Escribe (o sobreescribe) un archivo de texto, creando las carpetas
 * intermedias si hacen falta.
 */
export async function writeFile(target: string, content: string): Promise<void> {
  await ensureDir(path.dirname(target));
  await fs.writeFile(target, content, 'utf-8');
}