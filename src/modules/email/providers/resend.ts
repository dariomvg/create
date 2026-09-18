import type { FormaProvider } from '../../../core/types.js';
import { resolveTemplateDir } from '../../../utils/paths.js';

export const resendProvider: FormaProvider = {
  id: 'resend',
  name: 'Resend',
  description: 'Transactional email with Resend + React Email',

  templateDir: resolveTemplateDir('email', 'resend'),

  // svix sale de acá: ya no es una dep base del provider, porque solo
  // la necesita la feature webhooks (verificar la firma). Si alguien
  // instala solo "sending", no tiene sentido que se lleve svix.
  dependencies: ['resend', 'server-only'],

  features: [
    { featureId: 'sending' },
    { featureId: 'transactional' },
    {
      featureId: 'webhooks',
      dependencies: ['svix'],
      // route.ts vive DENTRO de templates/resend/webhooks/ — delgado,
      // solo verifica la firma con svix y despacha a actions.ts (sin
      // "use server", porque lo único que lo llama es este mismo route
      // handler).
      routes: [{ from: 'webhooks/route.ts', to: 'app/api/webhooks/resend/route.ts' }],
    },
  ],
};