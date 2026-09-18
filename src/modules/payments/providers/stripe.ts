import type { FormaProvider } from '../../../core/types.js';
import { resolveTemplateDir } from '../../../utils/paths.js';

export const stripeProvider: FormaProvider = {
  id: 'stripe',
  name: 'Stripe',
  description: 'Payments and subscriptions with Stripe',

  templateDir: resolveTemplateDir('payments', 'stripe'),

  dependencies: ['stripe', 'zod', 'server-only'],

  features: [
    {
      featureId: 'one-time',
      routes: [{ from: 'one-time/route.ts', to: 'app/api/webhooks/stripe/route.ts' }],
    },
    {
      featureId: 'subscriptions',
      routes: [
        { from: 'subscriptions/route.ts', to: 'app/api/webhooks/stripe-subscriptions/route.ts' },
      ],
    },
    {
      featureId: 'billing-management',
      routes: [
        { from: 'billing-management/route.ts', to: 'app/api/webhooks/stripe-billing/route.ts' },
      ],
    },
  ],
};