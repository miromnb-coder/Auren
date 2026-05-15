import type { AurenIntentResult } from '../core/types';

export function routeIntent(message: string): AurenIntentResult {
  const trimmedMessage = message.trim();

  if (!trimmedMessage) {
    return {
      intent: 'unknown',
      confidence: 0.2,
      reason: 'The message is empty, so the v0.1 router cannot infer intent.',
      needsMemory: false,
      needsTools: false,
      toolHints: [],
    };
  }

  return {
    intent: 'general_chat',
    confidence: 0.55,
    reason:
      'Auren v0.1 uses a language-agnostic default route. Deeper multilingual intent detection belongs to the model layer in a later version.',
    needsMemory: true,
    needsTools: false,
    toolHints: [],
  };
}
