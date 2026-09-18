import type { FormaProvider } from '../../../core/types.js';
import { resolveTemplateDir } from '../../../utils/paths.js';

export const supabaseProvider: FormaProvider = {
  id: 'supabase',
  name: 'Supabase',
  description: 'Authentication with Supabase',

  templateDir: resolveTemplateDir('auth', 'supabase'),

  dependencies: ['@supabase/ssr', '@supabase/supabase-js'],

  features: [
    {
      featureId: 'basic-auth',
      // El callback de OAuth/PKCE pasa de vivir en common/ (como
      // route.ts, junto a proxy.ts) a vivir DENTRO de basic-auth/ — es
      // parte central del flujo de sign-in, no algo compartido por
      // todas las features del provider (user-management no lo
      // necesita). Como ahora está solo en su propia carpeta de
      // feature, ya no hace falta el nombre distintivo
      // "callback.route.ts": puede llamarse route.ts directo. Avisame
      // si en la práctica user-management también depende de este
      // callback sin basic-auth instalado — habría que repensarlo.
      routes: [{ from: 'basic-auth/route.ts', to: 'app/api/auth/callback/route.ts' }],
    },
    { featureId: 'user-management' },
  ],
};