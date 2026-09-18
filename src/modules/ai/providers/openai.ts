import type { FormaProvider } from '../../../core/types.js';
import { resolveTemplateDir } from '../../../utils/paths.js';

export const openaiProvider: FormaProvider = {
  id: 'openai',
  name: 'OpenAI',
  description: 'GPT models via the official OpenAI SDK',

  templateDir: resolveTemplateDir('ai', 'openai'),

  dependencies: ['openai', 'zod', 'zod-to-json-schema', 'server-only'],

  features: [
    {
      featureId: 'text-generation',
      routes: [{ from: 'text-generation/route.ts', to: 'app/api/openai/stream/route.ts' }],
    },
    {
      featureId: 'chat',
      // Dos archivos de origen distintos dentro de chat/ (no pueden
      // llamarse igual en la misma carpeta), cada uno a su propio
      // endpoint: streaming de texto y streaming de audio/voz.
      routes: [
        { from: 'chat/stream-route.ts', to: 'app/api/openai-chat/stream/route.ts' },
        { from: 'chat/audio-route.ts', to: 'app/api/openai-chat/speech/route.ts' },
      ],
    },
    { featureId: 'tool-calling' },
  ],
};