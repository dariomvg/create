import type { FormaProvider } from '../../../core/types.js';
import { resolveTemplateDir } from '../../../utils/paths.js';

export const anthropicProvider: FormaProvider = {
  id: 'anthropic',
  name: 'Anthropic',
  description: 'Claude models via @anthropic-ai/sdk',

  templateDir: resolveTemplateDir('ai', 'anthropic'),

  dependencies: ['@anthropic-ai/sdk', 'zod', 'zod-to-json-schema'],

  features: [
    {
      featureId: 'text-generation',
      routes: [{ from: 'text-generation/route.ts', to: 'app/api/anthropic/stream/route.ts' }],
    },
    {
      featureId: 'chat',
      routes: [{ from: 'chat/route.ts', to: 'app/api/anthropic/chat/stream/route.ts' }],
    },
    { featureId: 'tool-calling' },
  ],
};