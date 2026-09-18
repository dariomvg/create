import path from 'node:path';
import { readFileIfExists } from './fs.js';

/**
 * Tipo mínimo — no modelamos el package.json completo (scripts, exports,
 * etc.), solo los campos que el CLI necesita leer del proyecto del usuario.
 */
export interface PackageJson {
  name?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  [key: string]: unknown;
}

/**
 * Lee el package.json del proyecto DESTINO (el proyecto Next.js del
 * usuario, no el del CLI). Devuelve null si no existe o si no es JSON
 * válido — quien llama decide qué hacer en ese caso (detect-project.ts
 * lo trata como "no es un proyecto Next.js válido").
 */
export async function readPackageJson(projectRoot: string): Promise<PackageJson | null> {
  const raw = await readFileIfExists(path.join(projectRoot, 'package.json'));
  if (raw === null) return null;

  try {
    return JSON.parse(raw) as PackageJson;
  } catch {
    return null;
  }
}

/**
 * Chequea si un paquete ya está en dependencies O en devDependencies.
 * Usado por install-deps.ts para no reinstalar algo que el usuario ya
 * tiene (por ejemplo, si ya usaba 'resend' por su cuenta antes de correr
 * el CLI).
 */
export function hasDependency(pkg: PackageJson, name: string): boolean {
  return Boolean(pkg.dependencies?.[name] ?? pkg.devDependencies?.[name]);
}

/**
 * Filtra una lista de paquetes a instalar, devolviendo solo los que
 * TODAVÍA no están en el proyecto destino. Pensado para usarse justo
 * antes de correr el install real, así el spinner y el comando de
 * instalación no incluyen cosas de más.
 */
export function filterNewDependencies(pkg: PackageJson, deps: string[]): string[] {
  return deps.filter((dep) => !hasDependency(pkg, dep));
}