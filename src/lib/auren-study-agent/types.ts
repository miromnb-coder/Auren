import type { AurenThinkingEvent } from '../auren-agent/core/types';
import type { StudyFocusCard, StudySubject, StudyTask } from '../aurenStudyFocus';

export type StudyAgentIntent =
  | 'explain_concept'
  | 'quiz_user'
  | 'make_study_plan'
  | 'review_notes'
  | 'prepare_for_exam'
  | 'solve_homework'
  | 'start_focus_session'
  | 'set_today_focus'
  | 'track_progress'
  | 'general_study_chat';

export type StudyAgentLanguage = 'fi' | 'en' | 'auto';

export type StudyAgentConversationMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export type StudyAgentInput = {
  message: string;
  userId?: string;
  conversation?: StudyAgentConversationMessage[];
  metadata?: Record<string, unknown>;
};

export type StudyAgentRoute = {
  intent: StudyAgentIntent;
  confidence: number;
  language: StudyAgentLanguage;
  reason: string;
};

export type StudyAgentContext = {
  userId?: string;
  message: string;
  conversation: StudyAgentConversationMessage[];
  route: StudyAgentRoute;
  study: {
    available: boolean;
    todayFocus: StudyFocusCard | null;
    subjects: StudySubject[];
    activeTasks: StudyTask[];
    upcomingTasks: StudyTask[];
    suggestedNextAction: string;
  };
  environment: {
    now: string;
    platform: 'native';
  };
};

export type StudyAgentAction =
  | {
      type: 'create_focus';
      title: string;
      nextStep: string;
      minutes: number;
      source: 'agent';
    }
  | {
      type: 'start_quiz';
      topic: string;
      source: 'agent';
    }
  | {
      type: 'save_study_memory';
      text: string;
      source: 'agent';
    };

export type StudyAgentSuggestion = {
  id: string;
  label: string;
  action: string;
  payload?: Record<string, unknown>;
};

export type StudyAgentResponseDraft = {
  answer: string;
  suggestions: StudyAgentSuggestion[];
  actions: StudyAgentAction[];
  metadata?: Record<string, unknown>;
};

export type StudyAgentResult = StudyAgentResponseDraft & {
  id: string;
  intent: StudyAgentIntent;
  confidence: number;
  context: StudyAgentContext;
  createdAt: string;
};

export type StudyAgentStreamEvent = {
  type: 'thinking_state';
  thinking: AurenThinkingEvent;
};

export type StudyAgentRunOptions = {
  onEvent?: (event: StudyAgentStreamEvent) => void;
};
