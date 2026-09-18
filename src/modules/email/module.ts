import type { FormaModule } from '../../core/types.js';
import { resendProvider } from './providers/resend.js';

export const emailModule: FormaModule = {
  id: 'email',
  name: 'Email',
  description: 'Transactional email delivery',

  features: [
    {
      id: 'sending',
      name: 'Sending',
      description: 'Plain text and HTML emails, multiple recipients, CC/BCC, reply-to, attachments',
    },
    {
      id: 'transactional',
      name: 'Transactional',
      description: 'Prebuilt event templates: verification, password reset, welcome, invitations, and more',
    },
    {
      id: 'webhooks',
      name: 'Webhooks',
      description: 'Receive and verify delivery events (sent, delivered, bounced, opened, clicked)',
    },
  ],

  // Hoy un solo provider. El día que sumes otro (ej: Postmark), se
  // agrega acá y el menú automáticamente empieza a preguntar "¿qué
  // provider(es)?" para cada feature que ambos soporten — no hay que
  // tocar nada más, ver selectProviders() en prompts/main-menu.ts.
  providers: [resendProvider],
};