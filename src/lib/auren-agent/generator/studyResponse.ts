import type { AurenContext } from '../core/types';

const NEXT_STEP_PATTERNS = [
  /mitä\s+(minun\s+)?(pitäisi\s+)?(opiskella|tehdä)/i,
  /mitä\s+opiskelen/i,
  /mitä\s+seuraavaksi/i,
  /mistä\s+aloitan/i,
  /aloita/i,
  /opiskella\s+nyt/i,
  /testaa\s+minua/i,
  /quiz\s+me/i,
  /what\s+should\s+i\s+(study|do)/i,
  /what\s+do\s+i\s+study/i,
  /where\s+should\s+i\s+start/i,
  /start\s+(a\s+)?(study\s+)?session/i,
  /next\s+study\s+step/i,
];

const GENERIC_ANSWER_PATTERNS = [
  /what would you like/i,
  /how can i help/i,
  /tell me what/i,
  /voin auttaa/i,
  /mitä haluat/i,
  /kerro mitä/i,
  /aloitetaan kun/i,
];

function inferLanguage(context: AurenContext) {
  const text = `${context.message} ${context.input.message}`.toLowerCase();
  const finnishSignals = ['mikä', 'mitä', 'mistä', 'minun', 'pitäisi', 'opiskella', 'aloita', 'testaa', 'tee', 'seuraavaksi'];

  return finnishSignals.some((signal) => text.includes(signal)) ? 'fi' : 'en';
}

function clean(value: string | null | undefined) {
  return value?.replace(/\s+/g, ' ').trim() ?? '';
}

function isDirectStudyRequest(context: AurenContext) {
  const message = `${context.message} ${context.input.message}`.trim();
  return NEXT_STEP_PATTERNS.some((pattern) => pattern.test(message));
}

function answerAlreadyUsesStudyData(answer: string, context: AurenContext) {
  const lowered = answer.toLowerCase();
  const focus = context.study?.todayFocus;

  if (focus?.title && lowered.includes(focus.title.toLowerCase())) return true;
  if (focus?.nextStep && lowered.includes(focus.nextStep.toLowerCase())) return true;

  return context.study?.activeTasks?.some((task) => lowered.includes(task.title.toLowerCase())) ?? false;
}

function isGenericAnswer(answer: string) {
  return GENERIC_ANSWER_PATTERNS.some((pattern) => pattern.test(answer));
}

export function createStudyDataAnswer(context: AurenContext): string | null {
  const language = inferLanguage(context);
  const study = context.study;

  if (!study?.available) return null;

  const focus = study.todayFocus;
  const firstTask = study.activeTasks[0];
  const firstStep = study.openSteps[0];

  if (focus) {
    if (language === 'fi') {
      return [
        `Aloita tästä: **${focus.title}**.`,
        '',
        `Seuraava askel on **${focus.nextStep}**. Tee siitä ${focus.sessionMinutes} minuutin sessio.`,
        '',
        `Tämän session tavoite: saat tämän askeleen tehtyä ja etenet kohdasta ${focus.completedSteps} / ${focus.totalSteps}.`,
      ].join('\n');
    }

    return [
      `Start here: **${focus.title}**.`,
      '',
      `Your next step is **${focus.nextStep}**. Make it a ${focus.sessionMinutes} minute session.`,
      '',
      `Session goal: finish this step and move forward from ${focus.completedSteps} / ${focus.totalSteps}.`,
    ].join('\n');
  }

  if (firstTask) {
    const nextStep = firstStep?.title || firstTask.description || 'start the first small step';
    const sessionMinutes = firstTask.estimatedMinutes ?? 25;

    if (language === 'fi') {
      return [
        `Aloita tehtävästä **${firstTask.title}**.`,
        '',
        `Seuraava askel: **${nextStep}**. Tee siitä ${sessionMinutes} minuutin sessio.`,
      ].join('\n');
    }

    return [
      `Start with **${firstTask.title}**.`,
      '',
      `Next step: **${nextStep}**. Make it a ${sessionMinutes} minute session.`,
    ].join('\n');
  }

  if (language === 'fi') {
    return 'Sinulla ei ole vielä opiskelufokusta. Lisää ensin aine, tehtävä tai koe, niin voin valita sinulle parhaan seuraavan askeleen.';
  }

  return 'You do not have a study focus yet. Add a subject, task, or exam first, and I can choose the best next step for you.';
}

export function shouldPreferStudyDataAnswer(context: AurenContext, modelAnswer: string) {
  if (!isDirectStudyRequest(context)) return false;
  if (!context.study?.available) return false;
  if (!context.study.todayFocus && context.study.activeTasks.length === 0) return false;
  if (!modelAnswer.trim()) return true;
  if (answerAlreadyUsesStudyData(modelAnswer, context)) return false;

  return isGenericAnswer(modelAnswer) || context.study.summary.hasFocus || context.study.activeTasks.length > 0;
}
