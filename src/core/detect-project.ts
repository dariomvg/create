import path from 'node:path';
import { pathExists } from '../utils/fs.js';
import { readPackageJson, hasDependency } from '../utils/package-json.js';

/**
 * Todo lo que el resto del CLI necesita saber sobre el proyecto en el
 * que se está ejecutando. Se calcula UNA sola vez al arrancar (en
 * index.ts) y de acá sale la forma base de ModuleContext (Bloque 3).
 */
export interface ProjectInfo {
  projectRoot: string;
  isNextProject: boolean;
  srcDir: boolean;
  router: 'app' | 'pages' | null;
  typescript: boolean;
}

/**
 * Analiza el proyecto ubicado en projectRoot (por default, la carpeta
 * desde donde se ejecutó el comando) y devuelve su "huella" — sin tirar
 * error ni preguntar nada. Quien llama a esta función (index.ts) decide
 * qué hacer si isNextProject es false.
 */
export async function detectProject(projectRoot: string = process.cwd()): Promise<ProjectInfo> {
  // 1. ¿Es un proyecto Next.js? Se determina por la presencia de "next"
  //    como dependencia real en el package.json, no solo por si hay
  //    carpetas que "parecen" de Next (evita falsos positivos).
  const pkg = await readPackageJson(projectRoot);
  const isNextProject = pkg !== null && hasDependency(pkg, 'next');

  // 2. ¿Usa carpeta src/? A partir de acá, todo lo demás se busca DENTRO
  //    de esa base (src/ o la raíz), porque app/ y pages/ pueden estar
  //    en cualquiera de los dos lugares según cómo se creó el proyecto.
  const srcDir = await pathExists(path.join(projectRoot, 'src'));
  const base = srcDir ? path.join(projectRoot, 'src') : projectRoot;

  // 3. ¿App Router o Pages Router? Si por algún motivo coexisten los dos
  //    (migración en curso), priorizamos 'app' porque es el que Next.js
  //    prioriza también a la hora de resolver rutas.
  const hasAppRouter = await pathExists(path.join(base, 'app'));
  const hasPagesRouter = await pathExists(path.join(base, 'pages'));
  const router: 'app' | 'pages' | null = hasAppRouter ? 'app' : hasPagesRouter ? 'pages' : null;

  // 4. ¿TypeScript? Se determina por la presencia de tsconfig.json en
  //    la raíz real del proyecto (esto SIEMPRE está en la raíz, nunca
  //    dentro de src/, tenga el proyecto src/ o no).
  const typescript = await pathExists(path.join(projectRoot, 'tsconfig.json'));

  return { projectRoot, isNextProject, srcDir, router, typescript };
}