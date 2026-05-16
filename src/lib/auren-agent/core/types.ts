export type AurenMode =
  | 'general'
  | 'study'
  | 'today'
  | 'memory'
  | 'focus'
  | 'money';

export type AurenIntent =
  | 'general_chat'
  | 'study_help'
  | 'daily_planning'
  | 'save_memory'
  | 'recall_memory'
  | 'create_plan'
  | 'focus_help'
  | 'tool_request'
  | 'unknown';

export type AurenMessageRole = 'system' | 'user' | 'assistant';

export type AurenConversationMessage = {
  id?: string;
  role: AurenMessageRole;
  content: string;
  createdAt?: string;
  metadata?: Record<string, unknown>;
};

export type AurenToolName =
  | 'calendar'
  | 'gmail'
  | 'tasks'
  | 'notes'
  | 'study'
  | 'finance';

export type AurenToolStatus = 'available' | 'placeholder' | 'not_connected';

export type AurenThinkingStage =
  | 'understanding'
  | 'routing'
  | 'context'
  | 'memory'
  | 'planning'
  | 'tools'
  | 'writing'
  | 'finalizing';

export type AurenThinkingEvent = {
  type: 'thinking_state';
  stage: AurenThinkingStage;
  title: string;
  detail: string;
  sequence: number;
  timestamp: string;
  metadata?: Record<string, unknown>;
};

export type AurenToolDefinition = {
  name: AurenToolName;
  label: string;
  description: string;
  status: AurenToolStatus;
};

export type AurenToolCall = {
  name: AurenToolName;
  input?: Record<string, unknown>;
};

export type AurenToolResult = {
  name: AurenToolName;
  success: boolean;
  status: AurenToolStatus;
  message: string;
  data?: Record<string, unknown>;
};

export type AurenIntentResult = {
  intent: AurenIntent;
  confidence: number;
  reason: string;
  needsMemory: boolean;
  needsTools: boolean;
  toolHints: AurenToolName[];
};

export type AurenModeResult = {
  mode: AurenMode;
  reason: string;
};

export type AurenUserContext = {
  userId?: string;
  displayName?: string;
  preferences: Record<string, unknown>;
};

export type AurenEnvironmentContext = {
  now: string;
  timezone?: string;
  platform: 'native' | 'web' | 'unknown';
};

export type AurenMemoryType =
  | 'user_preference'
  | 'study_goal'
  | 'active_project'
  | 'important_fact'
  | 'habit'
  | 'unknown';

export type AurenMemoryItem = {
  id: string;
  type: AurenMemoryType;
  text: string;
  confidence: number;
  createdAt: string;
  source?: 'chat' | 'system' | 'tool';
  metadata?: Record<string, unknown>;
};

export type AurenMemoryResult = {
  used: boolean;
  saved: boolean;
  items: AurenMemoryItem[];
  candidates: AurenMemoryItem[];
  note?: string;
};

export type AurenAgentInput = {
  message: string;
  userId?: string;
  mode?: AurenMode;
  conversation?: AurenConversationMessage[];
  metadata?: Record<string, unknown>;
};

export type AurenContext = {
  input: AurenAgentInput;
  message: string;
  intent: AurenIntentResult;
  mode: AurenMode;
  user: AurenUserContext;
  environment: AurenEnvironmentContext;
  conversation: AurenConversationMessage[];
  memory: AurenMemoryResult;
  availableTools: AurenToolDefinition[];
  createdAt: string;
};

export type AurenPlanStep = {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'ready' | 'complete' | 'blocked';
};

export type AurenPlan = {
  goal: string;
  summary: string;
  steps: AurenPlanStep[];
  suggestedToolCalls: AurenToolCall[];
};

export type AurenAgentStepStatus = 'pending' | 'running' | 'complete' | 'error';

export type AurenAgentStep = {
  id: string;
  label: string;
  status: AurenAgentStepStatus;
  detail?: string;
};

export type AurenSuggestion = {
  id: string;
  label: string;
  action: string;
  payload?: Record<string, unknown>;
};

export type AurenResponseMetadata = {
  fallback?: boolean;
  fallbackReason?: string;
  debug?: Record<string, unknown>;
  model?: string;
  groqStatus?: number;
  groqError?: string;
  groqErrorType?: string;
  recoveredFromPlainText?: boolean;
};

export type AurenResponseDraft = {
  answer: string;
  suggestions: AurenSuggestion[];
  metadata?: AurenResponseMetadata;
};

export type AurenResponseEvaluation = {
  passed: boolean;
  score: number;
  issues: string[];
  recommendations: string[];
};

export type AurenAgentResult = {
  id: string;
  answer: string;
  mode: AurenMode;
  intent: AurenIntent;
  confidence: number;
  steps: AurenAgentStep[];
  suggestions: AurenSuggestion[];
  memory: AurenMemoryResult;
  tools: {
    used: boolean;
    results: AurenToolResult[];
  };
  plan: AurenPlan;
  evaluation: AurenResponseEvaluation;
  context: AurenContext;
  createdAt: string;
};

export type AurenStreamEvent =
  | {
      type: 'step';
      message?: string;
      step?: AurenAgentStep;
    }
  | {
      type: 'thinking_state';
      thinking: AurenThinkingEvent;
    }
  | {
      type: 'token';
      message?: string;
    }
  | {
      type: 'result';
      result: AurenAgentResult;
    }
  | {
      type: 'error';
      error: string;
    };

export type AurenAgentEventHandler = (event: AurenStreamEvent) => void;

export type AurenAgentRunOptions = {
  onEvent?: AurenAgentEventHandler;
};
