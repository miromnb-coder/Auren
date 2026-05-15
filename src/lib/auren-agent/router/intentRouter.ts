import type { AurenIntent, AurenIntentResult, AurenToolName } from '../core/types';

const includesAny = (value: string, words: string[]) => {
  return words.some((word) => value.includes(word));
};

const getToolHints = (message: string): AurenToolName[] => {
  const hints: AurenToolName[] = [];

  if (includesAny(message, ['calendar', 'kalenteri', 'schedule'])) {
    hints.push('calendar');
  }

  if (includesAny(message, ['gmail', 'email', 'sähköposti', 'mail'])) {
    hints.push('gmail');
  }

  if (includesAny(message, ['task', 'todo', 'tehtävä', 'muistutus'])) {
    hints.push('tasks');
  }

  if (includesAny(message, ['note', 'notes', 'muistiinpano'])) {
    hints.push('notes');
  }

  if (includesAny(message, ['money', 'finance', 'raha', 'tilaus'])) {
    hints.push('finance');
  }

  return hints;
};

const detectSimpleIntent = (message: string): AurenIntent => {
  if (!message.trim()) {
    return 'unknown';
  }

  if (includesAny(message, ['muista', 'remember', 'save this', 'tallenna'])) {
    return 'save_memory';
  }

  if (includesAny(message, ['mitä muistat', 'what do you remember', 'recall memory'])) {
    return 'recall_memory';
  }

  if (includesAny(message, ['study', 'opisk', 'koe', 'quiz', 'explain', 'selitä'])) {
    return 'study_help';
  }

  if (includesAny(message, ['today', 'tänään', 'päivä', 'my day'])) {
    return 'daily_planning';
  }

  if (includesAny(message, ['plan', 'suunnitelma', 'suunnittele'])) {
    return 'create_plan';
  }

  if (includesAny(message, ['focus', 'keskity', 'pomodoro'])) {
    return 'focus_help';
  }

  if (getToolHints(message).length > 0) {
    return 'tool_request';
  }

  return 'general_chat';
};

export function routeIntent(message: string): AurenIntentResult {
  const normalizedMessage = message.toLowerCase();
  const intent = detectSimpleIntent(normalizedMessage);
  const toolHints = getToolHints(normalizedMessage);

  return {
    intent,
    confidence: intent === 'unknown' ? 0.2 : 0.72,
    reason: 'Detected with the lightweight v0.1 rule-based router.',
    needsMemory: intent === 'recall_memory' || intent === 'save_memory' || intent === 'study_help',
    needsTools: toolHints.length > 0,
    toolHints,
  };
}
