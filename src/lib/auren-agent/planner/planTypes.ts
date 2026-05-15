export type PlanPriority = 'low' | 'normal' | 'high';

export type PlanStage =
  | 'understand'
  | 'context'
  | 'plan'
  | 'tool_check'
  | 'respond'
  | 'follow_up';

export type PlanShape =
  | 'empty'
  | 'direct_answer'
  | 'explanation'
  | 'planning_only'
  | 'implementation'
  | 'debug'
  | 'decision'
  | 'review'
  | 'tool_action'
  | 'study'
  | 'today'
  | 'focus'
  | 'money'
  | 'memory';

export type PlanConstraint =
  | 'planning_first'
  | 'no_external_action'
  | 'scope_limited'
  | 'requires_confirmation'
  | 'safe_manual_fallback';

export type PlanExecutionMode =
  | 'answer_only'
  | 'prepare_only'
  | 'safe_execute'
  | 'needs_confirmation';

export type ToolPolicy =
  | 'never'
  | 'only_if_needed'
  | 'allow_safe_tools'
  | 'require_confirmation';

export type MemoryPolicy =
  | 'auto'
  | 'use_if_relevant'
  | 'ignore'
  | 'save_if_useful';

export type PlanQualityTarget = {
  concise?: boolean;
  mobileFriendly?: boolean;
  preferNextAction?: boolean;
  avoidOverPlanning?: boolean;
};

export type PlannerOptions = {
  priority?: PlanPriority;
  maxSteps?: number;

  /**
   * Optional override when another layer already knows the best plan shape.
   * Most of the time, planner.ts should infer this automatically.
   */
  preferredShape?: PlanShape;

  /**
   * Optional boundaries detected by router/context.
   * Planner should respect these without hardcoding user-specific phrases.
   */
  constraints?: PlanConstraint[];

  /**
   * Controls whether the planner may prepare tool calls.
   * Default should usually be "only_if_needed".
   */
  toolPolicy?: ToolPolicy;

  /**
   * Controls how memory should influence planning.
   * Default should usually be "use_if_relevant".
   */
  memoryPolicy?: MemoryPolicy;

  /**
   * Describes how far the agent is allowed to go.
   * Useful later when tools become real.
   */
  executionMode?: PlanExecutionMode;

  /**
   * Optional maximum number of tool calls the planner can suggest.
   */
  maxToolCalls?: number;

  /**
   * Soft quality preferences for the final plan.
   */
  qualityTarget?: PlanQualityTarget;
};

export type PlannerDiagnostics = {
  shape: PlanShape;
  priority: PlanPriority;
  constraints: PlanConstraint[];
  toolPolicy: ToolPolicy;
  memoryPolicy: MemoryPolicy;
  executionMode: PlanExecutionMode;
  reason: string;
};

export const DEFAULT_PLANNER_OPTIONS: Required<
  Pick<
    PlannerOptions,
    | 'priority'
    | 'maxSteps'
    | 'toolPolicy'
    | 'memoryPolicy'
    | 'executionMode'
    | 'maxToolCalls'
  >
> = {
  priority: 'normal',
  maxSteps: 4,
  toolPolicy: 'only_if_needed',
  memoryPolicy: 'use_if_relevant',
  executionMode: 'answer_only',
  maxToolCalls: 3,
};
