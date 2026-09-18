import type { ProjectInfo } from './detect-project.js';
import type { PackageManager } from './detect-package-manager.js';

/**
 * Todo lo que un provider necesita saber sobre el proyecto para poder
 * copiar sus archivos en el lugar correcto. Se arma UNA vez en index.ts,
 * juntando lo que devuelve detectProject() + detectPackageManager(), y
 * se pasa igual a todas las Selection que se ejecuten.
 *
 * Extiende ProjectInfo a propósito: así ya incluye projectRoot y srcDir,
 * que son justo los dos campos que espera PathContext (utils/paths.ts).
 * Cualquier ModuleContext puede usarse donde se pida un PathContext, sin
 * conversión ni import cruzado — matchea por forma.
 */
export interface ModuleContext extends ProjectInfo {
  packageManager: PackageManager;
}

/**
 * Una excepción de copiado: un archivo puntual dentro de
 * templates/<providerId>/ que NO va al destino automático
 * (lib/<moduleId>/<providerId>/...) sino a una ruta explícita dentro
 * del proyecto (por ejemplo, un route handler de webhook).
 */
export interface RouteDef {
  from: string; // ruta relativa DENTRO de templates/<providerId>/ (ej: 'basic-auth/webhook-route.ts')
  to: string;   // ruta relativa DESDE la raíz efectiva del proyecto (ej: 'app/api/webhooks/stripe/route.ts')
}

/**
 * Catálogo: una funcionalidad concreta dentro de un módulo (ej:
 * 'basic-auth' dentro de auth, 'one-time' dentro de payments). Es fijo
 * por módulo — no depende de qué provider termine soportándola. Se usa
 * para armar el multiselect de features de main-menu.ts.
 */
export interface FormaFeature {
  id: string;
  name: string;
  description: string;
}

/**
 * Lo que UN provider aporta para UNA feature puntual que soporta:
 * dependencias EXTRA (además de las base del provider) y rutas
 * explícitas propias de esa feature. No repite name/description —
 * esos ya están en el FormaFeature del módulo.
 */
export interface FeatureSupport {
  featureId: string;
  dependencies?: string[];
  routes?: RouteDef[];
}

/**
 * Un proveedor concreto dentro de un módulo. Ya no es "el módulo entero
 * o nada" (como Copyable en FormaUI) — ahora declara qué subconjunto de
 * las features del módulo soporta, vía "features". El multiselect de
 * providers en main-menu.ts se filtra a partir de acá: solo se ofrecen
 * los providers cuyo "features" incluya la featureId que el usuario ya
 * eligió.
 *
 * No hay más needsMiddleware: proxy.ts (si el provider lo trae) se
 * busca directo en su templateDir/common/ y se copia como cualquier
 * archivo con destino fijo — ver copy-files.ts.
 */
export interface FormaProvider {
  id: string;
  name: string;
  description?: string;
  templateDir: string;          // ruta ABSOLUTA a templates/<providerId>/ (ver utils/paths.ts → resolveTemplateDir)
  dependencies: string[];       // deps base, siempre se instalan si se elige este provider
  features: FeatureSupport[];   // qué features soporta + qué agrega cada una
}

/**
 * Agrupa uno o más providers bajo una misma categoría del menú principal
 * (auth, ai, payments, email). "features" es el catálogo fijo del
 * módulo (para el primer multiselect); "providers" son las opciones
 * concretas (para el segundo multiselect, ya filtrado por feature).
 */
export interface FormaModule {
  id: string;
  name: string;
  description: string;
  features: FormaFeature[];
  providers: FormaProvider[];
}

/**
 * El resultado final y aplanado de un paso del menú: "el usuario quiere
 * <featureId> del módulo <moduleId>, con el provider <providerId>".
 * Puede haber varias Selection con el mismo moduleId, o incluso el
 * mismo featureId con distinto providerId (ver rise-cli-guia.md, sección 1).
 */
export interface Selection {
  moduleId: string;
  featureId: string;
  providerId: string;
}

/**
 * Lo que devuelve main-menu.ts: cada Selection ya resuelta junto al
 * FormaProvider concreto que la soporta (no solo su id). Evita que
 * copy-files.ts/run-provider.ts tengan que volver a buscarlo en el
 * registry — ya viene resuelto desde el momento en que el usuario lo
 * eligió en el multiselect de providers.
 */
export interface ResolvedSelection {
  selection: Selection;
  provider: FormaProvider;
}