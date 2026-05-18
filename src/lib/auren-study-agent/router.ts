import type { StudyAgentIntent, StudyAgentLanguage, StudyAgentRoute } from './types';

function includesAny(text: string, signals: string[]) {
  return signals.some((signal) => text.includes(signal));
}

function inferLanguage(message: string): StudyAgentLanguage {
  const text = message.toLowerCase();
  const finnishSignals = [
    'miten',
    'mikä',
    'mitä',
    'miksi',
    'haluan',
    'kerro',
    'selitä',
    'tee',
    'opiskelu',
    'koe',
    'kokeeseen',
    'harjoit',
    'tehtävä',
    'suunnitelma',
  ];

  return includesAny(text, finnishSignals) ? 'fi' : 'auto';
}

export function routeStudyIntent(message: string): StudyAgentRoute {
  const text = message.toLowerCase().trim();
  const language = inferLanguage(message);

  const route = (intent: StudyAgentIntent, confidence: number, reason: string): StudyAgentRoute => ({
    intent,
    confidence,
    language,
    reason,
  });

  if (!text) {
    return route('general_study_chat', 0.45, 'Empty or very short message.');
  }

  if (includesAny(text, ['quiz me', 'test me', 'ask me', 'tee kysymyksiä', 'kysy minulta', 'testaa minua', 'kuulustele'])) {
    return route('quiz_user', 0.9, 'The user wants active recall or quiz practice.');
  }

  if (includesAny(text, ['flashcard', 'muistikort', 'anki'])) {
    return route('quiz_user', 0.82, 'Flashcards are handled as active recall practice in Study Agent v1.');
  }

  if (includesAny(text, ['study plan', 'make a plan', 'opiskelusuunnitelma', 'suunnitelma', 'lukusuunnitelma'])) {
    return route('make_study_plan', 0.88, 'The user wants a study plan.');
  }

  if (includesAny(text, ['exam', 'test', 'kokeeseen', 'koe', 'tentti', 'prepare for'])) {
    return route('prepare_for_exam', 0.86, 'The user is preparing for an exam or test.');
  }

  if (includesAny(text, ['explain', 'what is', 'selitä', 'mikä on', 'en ymmärrä', 'auta ymmärtämään'])) {
    return route('explain_concept', 0.88, 'The user wants a concept explained.');
  }

  if (includesAny(text, ['review notes', 'summarize notes', 'kertaa muistiinpanot', 'muistiinpanot', 'review my notes'])) {
    return route('review_notes', 0.82, 'The user wants notes reviewed.');
  }

  if (includesAny(text, ['homework', 'assignment', 'tehtävä', 'kotitehtävä', 'läksy'])) {
    return route('solve_homework', 0.78, 'The user is asking about homework or an assignment.');
  }

  if (includesAny(text, ['start session', 'focus session', 'aloita sessio', 'aloita opiskelu', 'start studying'])) {
    return route('start_focus_session', 0.86, 'The user wants to start a focused study session.');
  }

  if (includesAny(text, ['today focus', 'study focus', 'tämän päivän focus', 'opiskelufokus', 'aseta focus'])) {
    return route('set_today_focus', 0.84, 'The user wants to set or change today’s focus.');
  }

  if (includesAny(text, ['progress', 'streak', 'edistyminen', 'paljonko olen', 'miten menee'])) {
    return route('track_progress', 0.74, 'The user is asking about study progress.');
  }

  return route('general_study_chat', 0.64, 'Default study chat route.');
}
