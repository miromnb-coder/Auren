import type { AurenIntentResult, AurenMode, AurenModeResult } from '../core/types';

export function selectMode(
  requestedMode: AurenMode | undefined,
  intent: AurenIntentResult,
): AurenModeResult {
  if (requestedMode) {
    return {
      mode: requestedMode,
      reason: 'Using the mode explicitly provided by the app UI.',
    };
  }

  if (intent.intent === 'study_help') {
    return {
      mode: 'study',
      reason: 'Selected Study Mode from the detected intent.',
    };
  }

  if (intent.intent === 'daily_planning') {
    return {
      mode: 'today',
      reason: 'Selected Today Mode from the detected intent.',
    };
  }

  if (intent.intent === 'save_memory' || intent.intent === 'recall_memory') {
    return {
      mode: 'memory',
      reason: 'Selected Memory Mode from the detected intent.',
    };
  }

  if (intent.intent === 'focus_help') {
    return {
      mode: 'focus',
      reason: 'Selected Focus Mode from the detected intent.',
    };
  }

  return {
    mode: 'general',
    reason: 'Using General Mode as the safe default for Auren v0.1.',
  };
}
