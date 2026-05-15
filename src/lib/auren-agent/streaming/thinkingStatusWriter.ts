import { supabase } from '../../supabase';
import type { AurenIntent, AurenMode, AurenThinkingStage } from '../core/types';

export type ThinkingStatusInput = {
  stage: AurenThinkingStage;
  mode?: AurenMode;
  intent?: AurenIntent;
  message: string;
  planGoal?: string;
  toolNames?: string[];
};

export type ThinkingStatusCopy = {
  title: string;
  detail: string;
};

type ThinkingDetailResponse = {
  detail?: unknown;
};

const THINKING_DETAIL_FUNCTION = 'auren-thinking-detail';
const DETAIL_TIMEOUT_MS = 1200;
const MAX_DETAIL_LENGTH = 120;

const STAGE_TITLES: Record<AurenThinkingStage, string> = {
  understanding: 'Understanding your request',
  routing: 'Understanding your request',
  context: 'Checking relevant context',
  memory: 'Checking relevant context',
  planning: 'Planning the best response',
  tools: 'Checking available tools',
  writing: 'Preparing answer',
  finalizing: 'Finalizing',
};

const FALLBACK_DETAILS: Record<AurenThinkingStage, string> = {
  understanding: 'Finding the most useful way to help...',
  routing: 'Choosing the right kind of help for this request...',
  context: 'Reading the recent conversation and available context...',
  memory: 'Looking for useful saved context without overusing it...',
  planning: 'Choosing the clearest next step...',
  tools: 'Checking whether connected tools are needed...',
  writing: 'Writing a clear response for you...',
  finalizing: 'Polishing the answer before showing it...',
};

const cleanText = (value: string | null | undefined) => {
  return value?.replace(/\s+/g, ' ').trim() ?? '';
};

const limitText = (value: string, maxLength: number) => {
  const cleaned = cleanText(value);

  if (cleaned.length <= maxLength) {
    return cleaned;
  }

  return `${cleaned.slice(0, maxLength - 1).trim()}…`;
};

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error('Thinking status generation timed out.'));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
};

const getFallbackDetail = (input: ThinkingStatusInput) => {
  if (input.stage === 'planning') {
    if (input.mode === 'study' || input.intent === 'study_help') {
      return 'Choosing a simple path for this learning task...';
    }

    if (input.mode === 'money') {
      return 'Separating known details from assumptions...';
    }

    if (input.mode === 'focus' || input.intent === 'focus_help') {
      return 'Reducing this into one useful next action...';
    }
  }

  if (input.stage === 'tools' && input.toolNames?.length) {
    return `Checking ${input.toolNames.slice(0, 2).join(' and ')} before answering...`;
  }

  return FALLBACK_DETAILS[input.stage];
};

const safeCreateModelDetail = async (input: ThinkingStatusInput) => {
  try {
    const { data, error } = await withTimeout(
      supabase.functions.invoke<ThinkingDetailResponse>(THINKING_DETAIL_FUNCTION, {
        body: {
          stage: input.stage,
          title: STAGE_TITLES[input.stage],
          mode: input.mode,
          intent: input.intent,
          message: limitText(input.message, 1400),
          planGoal: limitText(input.planGoal ?? '', 800),
          toolNames: input.toolNames ?? [],
        },
      }),
      DETAIL_TIMEOUT_MS,
    );

    if (error) {
      return null;
    }

    return typeof data?.detail === 'string' && data.detail.trim()
      ? limitText(data.detail, MAX_DETAIL_LENGTH)
      : null;
  } catch {
    return null;
  }
};

export const createThinkingStatus = async (
  input: ThinkingStatusInput,
): Promise<ThinkingStatusCopy> => {
  const modelDetail = await safeCreateModelDetail(input);

  return {
    title: STAGE_TITLES[input.stage],
    detail: modelDetail ?? getFallbackDetail(input),
  };
};
