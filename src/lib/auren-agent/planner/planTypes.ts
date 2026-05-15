export type PlanPriority = 'low' | 'normal' | 'high';

export type PlanStage =
  | 'understand'
  | 'context'
  | 'plan'
  | 'respond'
  | 'follow_up';

export type PlannerOptions = {
  priority?: PlanPriority;
  maxSteps?: number;
};
