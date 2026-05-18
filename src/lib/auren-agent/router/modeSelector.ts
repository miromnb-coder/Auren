import type { AurenIntentResult, AurenMode, AurenModeResult } from '../core/types';

export function selectMode(
  requestedMode: AurenMode | undefined,
  _intent: AurenIntentResult,
): AurenModeResult {
  if (requestedMode && requestedMode !== 'study') {
    return {
      mode: 'study',
      reason: 'Auren is locked as a Study Agent, so non-study modes are routed to Study Mode.',
    };
  }

  return {
    mode: 'study',
    reason: 'Auren is locked as a personal AI Study Agent.',
  };
}
