import type { FormaModule } from './types.js';
import { emailModule } from '../modules/email/module.js';
import { aiModule } from '../modules/ai/module.js';
import { paymentsModule } from '../modules/payments/module.js';
import { authModule } from '../modules/auth/module.js';

/**
 * Todos los módulos disponibles del CLI, en el orden fijo del menú
 * (Auth, AI, Payments, Email — ver rise-cli-guia.md, sección 2).
 * main-menu.ts itera SOLO sobre este array — nunca importa un módulo
 * específico por su cuenta ni hardcodea IDs en otro lado. Es el único
 * lugar que hay que tocar para sumar un módulo nuevo al menú.
 */
export const registry: FormaModule[] = [
  authModule,
  aiModule,
  paymentsModule,
  emailModule,
];

/**
 * Busca un módulo por id. Se usa, por ejemplo, si en el futuro sumamos
 * un comando directo tipo `create add email` (sin pasar por el menú
 * interactivo) — cli.ts podría resolver el módulo pedido con esto.
 */
export function findModule(id: string): FormaModule | undefined {
  return registry.find((module) => module.id === id);
}

/**
 * Busca un provider específico dentro de un módulo. Útil para lo mismo
 * que findModule(), pero cuando además se especifica el provider
 * (ej: `create add payments --provider stripe`).
 */
export function findProvider(moduleId: string, providerId: string) {
  const module = findModule(moduleId);
  return module?.providers.find((provider) => provider.id === providerId);
}