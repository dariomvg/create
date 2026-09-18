import type { FormaProvider } from '../../../core/types.js';
import { resolveTemplateDir } from '../../../utils/paths.js';

export const vercelSdkProvider: FormaProvider = {
  id: 'vercel-sdk',

  // El nombre que se muestra en el prompt: "vercel-sdk" tal cual, con
  // la aclaración de qué modelo trae entre paréntesis.
  name: 'vercel-sdk (Gemini)',
  description: 'Gemini models via the Vercel AI SDK',

  templateDir: resolveTemplateDir('ai', 'vercel-sdk'),

  dependencies: ['ai', '@ai-sdk/google', 'zod'],

  features: [
    {
      featureId: 'text-generation',
      routes: [{ from: 'text-generation/route.ts', to: 'app/api/ai-sdk/stream/route.ts' }],
    },
    {
      featureId: 'chat',
      routes: [{ from: 'chat/route.ts', to: 'app/api/ai-sdk/chat/stream/route.ts' }],
    },
    { featureId: 'tool-calling' },
  ],
};