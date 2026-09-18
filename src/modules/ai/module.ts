import type { FormaModule } from '../../core/types.js';
import { anthropicProvider } from './providers/anthropic.js';
import { openaiProvider } from './providers/openai.js';
import { vercelSdkProvider } from './providers/vercel-sdk.js';

export const aiModule: FormaModule = {
  id: 'ai',
  name: 'AI',
  description: 'Integration with language models (Anthropic, OpenAI, Gemini)',

  features: [
    {
      id: 'text-generation',
      name: 'Text generation',
      description: 'Single-turn prompt completion, streamed',
    },
    {
      id: 'chat',
      name: 'Chat',
      description: 'Multi-turn conversational streaming',
    },
    {
      id: 'tool-calling',
      name: 'Tool calling',
      description: 'Function/tool calling for agentic workflows',
    },
  ],

  // Tres providers, los tres soportan las 3 features (ver
  // providers/*.ts) — main-menu.ts dispara el multiselect secundario
  // igual, filtrando por soporte, aunque acá el filtro no descarte a
  // ninguno.
  providers: [anthropicProvider, openaiProvider, vercelSdkProvider],
};