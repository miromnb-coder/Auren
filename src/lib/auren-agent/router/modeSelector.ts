import type { AurenIntentResult, AurenMode, AurenModeResult } from '../core/types';

export function selectMode(
  requestedMode: AurenMode | undefined,
  intent: AurenIntentResult,
): AurenModeResult {
  if (requestedMode) {
    return {
      mode: requestedMode === 'general' ? 'study' : requestedMode,
      reason: requestedMode === 'general'
        ? 'Auren is locked as a study agent, so General Mode is routed to Study Mode.'
        : 'Using the mode explicitly provided by the app UI.',
    };
  }

  if (intent.intent === 'money_help') {
    return {
      mode: 'money',
      reason: 'Selected Money Mode from the detected intent.',
    };
  }

  if (intent.intent === 'save_memory' || intent.intent === 'recall_memory') {
    return {
      mode: 'memory',
      reason: 'Selected Memory Mode only for explicit memory work.',
    };
  }

  return {
    mode: 'study',
    reason: 'Auren is locked as a personal AI Study Agent by default.',
  };
}
