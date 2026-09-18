import type { FormaModule } from '../../core/types.js';
import { auth0Provider } from './providers/auth0.js';
import { clerkProvider } from './providers/clerk.js';
import { supabaseProvider } from './providers/supabase.js';

export const authModule: FormaModule = {
  id: 'auth',
  name: 'Auth',
  description: 'Authentication (Auth0, Clerk, Supabase)',

  // Catálogo fijo del módulo — ver rise-cli-guia.md, sección 1. No
  // todos los providers soportan las 4: eso lo declara cada uno en su
  // propio features: FeatureSupport[] (ver providers/*.ts), y es lo
  // que main-menu.ts usa para filtrar el segundo multiselect.
  features: [
    {
      id: 'basic-auth',
      name: 'Basic auth',
      description: 'Sign in, sign up, and session handling',
    },
    {
      id: 'authorization',
      name: 'Authorization',
      description: 'Role- and permission-based access control',
    },
    {
      id: 'organizations',
      name: 'Organizations',
      description: 'Multi-tenant organizations, invitations, and members',
    },
    {
      id: 'user-management',
      name: 'User management',
      description: 'Self-service profile, email/password changes, and account deletion',
    },
  ],

  // Ya no hay "uno solo se elige" (needsMiddleware/setupFile de FormaUI
  // quedaron atrás): una misma feature puede terminar instalada con más
  // de un provider a la vez (ej: basic-auth con Clerk y con Supabase).
  // proxy.ts de cada uno se copia directo a la raíz del proyecto sin
  // merge — si el usuario elige dos providers con basic-auth, el
  // segundo proxy.ts pisa al primero (con confirm), tal como se definió
  // en copy-files.ts.
  providers: [clerkProvider, auth0Provider, supabaseProvider],
};