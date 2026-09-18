import type { FormaModule } from '../../core/types.js';
import { stripeProvider } from './providers/stripe.js';
import { mercadopagoProvider } from './providers/mercadopago.js';
import { lemonsqueezyProvider } from './providers/lemonsqueezy.js';

export const paymentsModule: FormaModule = {
  id: 'payments',
  name: 'Payments',
  description: 'Charges and subscriptions (Stripe, Mercado Pago, Lemon Squeezy)',

  features: [
    {
      id: 'one-time',
      name: 'One-time payments',
      description: 'Single charges and checkout for individual purchases',
    },
    {
      id: 'subscriptions',
      name: 'Subscriptions',
      description: 'Recurring billing, plan changes, and cancellation flows',
    },
    {
      id: 'billing-management',
      name: 'Billing management',
      description: 'Customer portal, invoices, and payment method management',
    },
  ],

  // Stripe soporta las 3, Mercado Pago y Lemon Squeezy solo one-time y
  // subscriptions (ver providers/*.ts) — main-menu.ts filtra el
  // multiselect de providers automáticamente según cuál feature se
  // haya elegido, no hace falta nada especial acá.
  providers: [stripeProvider, mercadopagoProvider, lemonsqueezyProvider],
};