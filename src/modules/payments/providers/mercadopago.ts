import type { FormaProvider } from '../../../core/types.js';
import { resolveTemplateDir } from '../../../utils/paths.js';

export const mercadopagoProvider: FormaProvider = {
  id: 'mercadopago',
  name: 'Mercado Pago',
  description: 'Payments and subscriptions with Mercado Pago',

  templateDir: resolveTemplateDir('payments', 'mercadopago'),

  dependencies: ['mercadopago', 'zod', 'server-only'],

  features: [
    {
      featureId: 'one-time',
      routes: [{ from: 'one-time/route.ts', to: 'app/api/webhooks/mercadopago/route.ts' }],
    },
    {
      featureId: 'subscriptions',
      routes: [
        {
          from: 'subscriptions/route.ts',
          to: 'app/api/webhooks/mercadopago-subscriptions/route.ts',
        },
      ],
    },
  ],
};