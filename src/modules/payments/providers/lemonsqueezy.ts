import type { FormaProvider } from '../../../core/types.js';
import { resolveTemplateDir } from '../../../utils/paths.js';

export const lemonsqueezyProvider: FormaProvider = {
  id: 'lemonsqueezy',
  name: 'Lemon Squeezy',
  description: 'Payments and subscriptions with Lemon Squeezy',

  templateDir: resolveTemplateDir('payments', 'lemonsqueezy'),

  dependencies: ['zod', '@lemonsqueezy/lemonsqueezy.js'],

  features: [
    {
      featureId: 'one-time',
      routes: [{ from: 'one-time/route.ts', to: 'app/api/webhooks/lemonsqueezy/route.ts' }],
    },
    {
      featureId: 'subscriptions',
      routes: [
        {
          from: 'subscriptions/route.ts',
          to: 'app/api/webhooks/lemonsqueezy-subscriptions/route.ts',
        },
      ],
    },
  ],
};