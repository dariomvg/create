import type { FormaProvider } from '../../../core/types.js';
import { resolveTemplateDir } from '../../../utils/paths.js';

export const auth0Provider: FormaProvider = {
  id: 'auth0',
  name: 'Auth0',
  description: 'Authentication with Auth0',

  templateDir: resolveTemplateDir('auth', 'auth0'),

  dependencies: ['@auth0/nextjs-auth0', 'server-only'],

  // basic-auth y organizations, sin routes ni dependencies EXTRA
  // propias por ahora — todo lo que Auth0 necesita (proxy.ts,
  // .env.example) vive en common/, que se copia una sola vez sin
  // importar cuál de las dos features se elija primero.
  features: [{ featureId: 'basic-auth' }, { featureId: 'organizations' }],
};