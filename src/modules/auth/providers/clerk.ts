import type { FormaProvider } from '../../../core/types.js';
import { resolveTemplateDir } from '../../../utils/paths.js';

export const clerkProvider: FormaProvider = {
  id: 'clerk',
  name: 'Clerk',
  description: 'Authentication with Clerk',

  templateDir: resolveTemplateDir('auth', 'clerk'),

  dependencies: ['@clerk/nextjs'],

  features: [
    { featureId: 'basic-auth' },
    { featureId: 'authorization' },
    { featureId: 'organizations' },
  ],
};