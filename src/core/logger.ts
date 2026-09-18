import * as clack from '@clack/prompts';
import pc from 'picocolors';

/**
 * Wrapper fino sobre @clack/prompts. La mayoría de los archivos del CLI
 * pasan por acá para intro/outro/spinner/log/confirm — así el estilo
 * (colores, manejo de cancelación) queda consistente en un solo lugar
 * y no repetido en cada módulo. multiselect/select se siguen pidiendo
 * directo a @clack/prompts donde hacen falta (ver main-menu.ts), ya que
 * este archivo no los envuelve.
 */

/**
 * Título del CLI con color de fondo, y debajo (opcional) una línea de
 * descripción con EL MISMO color de fondo — no un texto atenuado
 * (dim), sino el mismo bloque de color continuando en la línea de
 * abajo, para que se lea como un solo bloque de intro.
 */
export function intro(title: string, subtitle?: string): void {
  clack.intro(pc.bgCyan(pc.black(` ${title} `)));

  if (subtitle) {
    console.log(pc.cyan(` ${subtitle} `));
  }
}

export function outro(message: string): void {
  clack.outro(message);
}

/**
 * Devuelve un spinner ya arrancado. Quien lo llama es responsable de
 * pararlo con spinner.stop('mensaje final') cuando termina la tarea.
 * Se usa en install-deps.ts mientras corre el install real.
 */
export function startSpinner(message: string) {
  const spinner = clack.spinner();
  spinner.start(message);
  return spinner;
}

/**
 * Mensajes de log puntuales, fuera de un spinner. success/error/info/warn
 * cubren el 90% de los casos; step se usa para marcar cada etapa dentro
 * de runProvider() (copiando archivos, instalando deps, etc.).
 */
export const log = {
  success: (message: string) => clack.log.success(message),
  error: (message: string) => clack.log.error(message),
  info: (message: string) => clack.log.info(message),
  warn: (message: string) => clack.log.warn(message),
  step: (message: string) => clack.log.step(message),
};

/**
 * Re-exportado desde clack, pero con un tipado más preciso: "value is
 * symbol" (type guard), no un boolean genérico. Esto es lo que le
 * permite a TypeScript, después de un `if (isCancel(x)) cancelAndExit();`,
 * angostar el tipo de "x" y sacarle el symbol de cancelación en el resto
 * del código — sin esto, TS sigue viendo "string[] | symbol" (o lo que
 * sea) más abajo, aunque en los hechos ya cortamos ese caso.
 */
export function isCancel(value: unknown): value is symbol {
  return clack.isCancel(value);
}

/**
 * Pregunta sí/no al usuario. Si cancela (Ctrl+C/Esc), corta el CLI acá
 * mismo con cancelAndExit() — así quien llama a confirm() nunca tiene
 * que manejar el caso de cancelación por su cuenta, siempre recibe un
 * boolean real. Se usa tanto para "¿querés integrar <Módulo>?" en
 * main-menu.ts como para los overwrite de copy-files.ts.
 */
export async function confirm(message: string): Promise<boolean> {
  const answer = await clack.confirm({ message });
  if (isCancel(answer)) cancelAndExit();
  return answer;
}

/**
 * Punto único de salida cuando el usuario cancela. El tipo de retorno
 * "never" le confirma a TypeScript que después de llamar a esto el
 * código no sigue — útil para que el compilador no se queje de valores
 * "posiblemente undefined" más abajo en el flujo.
 */
export function cancelAndExit(message = 'Operation cancelled.'): never {
  clack.cancel(message);
  process.exit(0);
}