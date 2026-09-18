import { multiselect } from '@clack/prompts';
import pc from 'picocolors';
import { registry } from '../core/registry.js';
import { confirm, isCancel, cancelAndExit, log } from '../core/logger.js';
import type { FormaModule, FormaProvider, ResolvedSelection } from '../core/types.js';

/**
 * Corre el flujo completo del menú y devuelve la lista final de
 * ResolvedSelection a instalar — ya resuelta, plana, lista para
 * pasarle a runProvider() (core/run-provider.ts). Todo lo de "¿qué
 * módulo? ¿qué feature? ¿qué provider(es)?" se resuelve acá adentro;
 * el resto del CLI no necesita saber que existió un menú.
 *
 * "registry" ya viene en el orden fijo [Auth, AI, Payments, Email] —
 * por eso el for-of alcanza para respetar ese orden, sin necesidad de
 * una constante de ordering separada acá.
 */
export async function runMainMenu(): Promise<ResolvedSelection[]> {
  const resolved: ResolvedSelection[] = [];

  for (const module of registry) {
    const wantsModule = await confirm(pc.bold(`Do you want to integrate ${module.name}?`));
    if (!wantsModule) continue;

    const featureIds = await selectFeatures(module);

    for (const featureId of featureIds) {
      const feature = module.features.find((f) => f.id === featureId)!;
      const providers = await selectProviders(module, feature.id, feature.name);

      for (const provider of providers) {
        resolved.push({
          selection: { moduleId: module.id, featureId: feature.id, providerId: provider.id },
          provider,
        });
      }
    }
  }

  return resolved;
}

/**
 * Multiselect de features del módulo — el catálogo completo, sin
 * filtrar todavía por provider (eso pasa recién en selectProviders,
 * una vez elegida la feature).
 */
async function selectFeatures(module: FormaModule): Promise<string[]> {
  const featureIds = await multiselect({
    message: pc.bold(`${module.name}: select the features you want to integrate`),
    options: module.features.map((feature) => ({
      value: feature.id,
      label: feature.name,
      hint: feature.description,
    })),
    required: true,
  });

  if (isCancel(featureIds)) cancelAndExit();

  return featureIds;
}

/**
 * Multiselect de providers para UNA feature puntual, ya filtrado a los
 * que la soportan. Es multiselect (no select) a propósito: permite que
 * una misma feature termine instalada con más de un provider a la vez
 * (ej: basic-auth con Clerk y con Supabase en la misma corrida — ver
 * rise-cli-guia.md, sección 1).
 */
async function selectProviders(
  module: FormaModule,
  featureId: string,
  featureName: string,
): Promise<FormaProvider[]> {
  const supporting = module.providers.filter((provider) =>
    provider.features.some((support) => support.featureId === featureId),
  );

  if (supporting.length === 0) {
    log.warn(`No provider in "${module.name}" supports "${featureName}" yet — skipping.`);
    return [];
  }

  const providerIds = await multiselect({
    message: pc.bold(`${featureName}: select provider(s)`),
    options: supporting.map((provider) => ({
      value: provider.id,
      label: provider.name,
      hint: provider.description,
    })),
    required: true,
  });

  if (isCancel(providerIds)) cancelAndExit();

  return supporting.filter((provider) => providerIds.includes(provider.id));
}