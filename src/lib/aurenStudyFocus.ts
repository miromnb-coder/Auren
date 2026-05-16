import { supabase } from './supabase';

export type StudyFocusStatus = 'empty' | 'active' | 'in_progress' | 'completed' | 'dismissed' | 'archived';
export type StudyTaskStatus = 'todo' | 'in_progress' | 'done' | 'cancelled' | 'archived';
export type StudyTaskPriority = 'low' | 'normal' | 'high' | 'urgent';
export type StudyTaskType =
  | 'homework'
  | 'exam'
  | 'essay'
  | 'reading'
  | 'practice'
  | 'quiz'
  | 'project'
  | 'note_review'
  | 'general_goal';

export type StudySubject = {
  id: string;
  userId: string;
  name: string;
  level: 'beginner' | 'intermediate' | 'advanced' | 'unknown';
  color: string | null;
  icon: string | null;
  notes: string | null;
  status: 'active' | 'paused' | 'archived';
  createdAt: string;
  updatedAt: string;
};

export type StudyTask = {
  id: string;
  userId: string;
  subjectId: string | null;
  topicId: string | null;
  source: 'manual' | 'chat' | 'ai' | 'calendar' | 'gmail' | 'import' | 'tool';
  type: StudyTaskType;
  title: string;
  description: string | null;
  dueAt: string | null;
  scheduledFor: string | null;
  priority: StudyTaskPriority;
  status: StudyTaskStatus;
  estimatedMinutes: number | null;
  difficulty: 'easy' | 'medium' | 'hard' | 'unknown';
  confidence: number;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type StudyTaskStep = {
  id: string;
  userId: string;
  taskId: string;
  subjectId: string | null;
  topicId: string | null;
  title: string;
  description: string | null;
  orderIndex: number;
  status: 'todo' | 'in_progress' | 'done' | 'skipped' | 'archived';
  estimatedMinutes: number | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type StudyFocusCard = {
  id: string | null;
  userId: string;
  focusDate: string;
  taskId: string | null;
  stepId: string | null;
  subjectId: string | null;
  topicId: string | null;
  title: string;
  nextStep: string;
  sessionMinutes: number;
  completedSteps: number;
  totalSteps: number;
  progress: number;
  status: StudyFocusStatus;
  selectedBy: 'user' | 'focus_engine' | 'ai' | 'system';
  priorityScore: number;
  reason: string | null;
  reasonFactors: Record<string, unknown>;
  metadata: Record<string, unknown>;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type StudySession = {
  id: string;
  userId: string;
  subjectId: string | null;
  topicId: string | null;
  taskId: string | null;
  stepId: string | null;
  focusCardId: string | null;
  subject: string | null;
  topic: string | null;
  goal: string | null;
  status: 'planned' | 'active' | 'completed' | 'cancelled';
  plannedMinutes: number;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type StudySubjectRow = {
  id: string;
  user_id: string;
  name: string;
  level: StudySubject['level'] | null;
  color: string | null;
  icon: string | null;
  notes: string | null;
  status: StudySubject['status'];
  created_at: string;
  updated_at: string;
};

type StudyTaskRow = {
  id: string;
  user_id: string;
  subject_id: string | null;
  topic_id: string | null;
  source: StudyTask['source'];
  type: StudyTaskType;
  title: string;
  description: string | null;
  due_at: string | null;
  scheduled_for: string | null;
  priority: StudyTaskPriority;
  status: StudyTaskStatus;
  estimated_minutes: number | null;
  difficulty: StudyTask['difficulty'];
  confidence: number | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

type StudyTaskStepRow = {
  id: string;
  user_id: string;
  task_id: string;
  subject_id: string | null;
  topic_id: string | null;
  title: string;
  description: string | null;
  order_index: number;
  status: StudyTaskStep['status'];
  estimated_minutes: number | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

type StudyFocusCardRow = {
  id: string;
  user_id: string;
  focus_date: string;
  task_id: string | null;
  step_id: string | null;
  subject_id: string | null;
  topic_id: string | null;
  title: string;
  next_step: string | null;
  session_minutes: number;
  completed_steps: number;
  total_steps: number;
  status: StudyFocusStatus;
  selected_by: StudyFocusCard['selectedBy'];
  priority_score: number;
  reason: string | null;
  reason_factors: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

type StudySessionRow = {
  id: string;
  user_id: string;
  subject_id: string | null;
  topic_id: string | null;
  task_id: string | null;
  step_id: string | null;
  focus_card_id: string | null;
  subject: string | null;
  topic: string | null;
  goal: string | null;
  status: StudySession['status'];
  planned_minutes: number;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  updated_at: string;
};

function clampProgress(completedSteps: number, totalSteps: number) {
  if (totalSteps <= 0) return 0;
  return Math.min(Math.max(completedSteps / totalSteps, 0), 1);
}

export function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function createEmptyStudyFocusCard(userId: string, focusDate = getLocalDateKey()): StudyFocusCard {
  return {
    id: null,
    userId,
    focusDate,
    taskId: null,
    stepId: null,
    subjectId: null,
    topicId: null,
    title: 'Set your study focus',
    nextStep: 'Tell Auren what you are working on today',
    sessionMinutes: 25,
    completedSteps: 0,
    totalSteps: 1,
    progress: 0,
    status: 'empty',
    selectedBy: 'system',
    priorityScore: 0,
    reason: null,
    reasonFactors: {},
    metadata: {},
    startedAt: null,
    completedAt: null,
    createdAt: null,
    updatedAt: null,
  };
}

function normalizeSubject(row: StudySubjectRow): StudySubject {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    level: row.level ?? 'unknown',
    color: row.color,
    icon: row.icon,
    notes: row.notes,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeTask(row: StudyTaskRow): StudyTask {
  return {
    id: row.id,
    userId: row.user_id,
    subjectId: row.subject_id,
    topicId: row.topic_id,
    source: row.source,
    type: row.type,
    title: row.title,
    description: row.description,
    dueAt: row.due_at,
    scheduledFor: row.scheduled_for,
    priority: row.priority,
    status: row.status,
    estimatedMinutes: row.estimated_minutes,
    difficulty: row.difficulty,
    confidence: row.confidence ?? 0.7,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeTaskStep(row: StudyTaskStepRow): StudyTaskStep {
  return {
    id: row.id,
    userId: row.user_id,
    taskId: row.task_id,
    subjectId: row.subject_id,
    topicId: row.topic_id,
    title: row.title,
    description: row.description,
    orderIndex: row.order_index,
    status: row.status,
    estimatedMinutes: row.estimated_minutes,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeFocusCard(row: StudyFocusCardRow): StudyFocusCard {
  const totalSteps = Math.max(row.total_steps ?? 1, 1);
  const completedSteps = Math.min(Math.max(row.completed_steps ?? 0, 0), totalSteps);

  return {
    id: row.id,
    userId: row.user_id,
    focusDate: row.focus_date,
    taskId: row.task_id,
    stepId: row.step_id,
    subjectId: row.subject_id,
    topicId: row.topic_id,
    title: row.title?.trim() || 'Today\'s Focus',
    nextStep: row.next_step?.trim() || 'Start your next study step',
    sessionMinutes: row.session_minutes ?? 25,
    completedSteps,
    totalSteps,
    progress: clampProgress(completedSteps, totalSteps),
    status: row.status,
    selectedBy: row.selected_by,
    priorityScore: row.priority_score ?? 0,
    reason: row.reason,
    reasonFactors: row.reason_factors ?? {},
    metadata: row.metadata ?? {},
    startedAt: row.started_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeSession(row: StudySessionRow): StudySession {
  return {
    id: row.id,
    userId: row.user_id,
    subjectId: row.subject_id,
    topicId: row.topic_id,
    taskId: row.task_id,
    stepId: row.step_id,
    focusCardId: row.focus_card_id,
    subject: row.subject,
    topic: row.topic,
    goal: row.goal,
    status: row.status,
    plannedMinutes: row.planned_minutes,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function loadTodayStudyFocusCard(userId: string, focusDate = getLocalDateKey()) {
  const { data, error } = await supabase
    .from('auren_study_focus_cards')
    .select(
      'id,user_id,focus_date,task_id,step_id,subject_id,topic_id,title,next_step,session_minutes,completed_steps,total_steps,status,selected_by,priority_score,reason,reason_factors,metadata,started_at,completed_at,created_at,updated_at',
    )
    .eq('user_id', userId)
    .eq('focus_date', focusDate)
    .in('status', ['active', 'in_progress', 'completed'])
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) return createEmptyStudyFocusCard(userId, focusDate);

  return normalizeFocusCard(data as StudyFocusCardRow);
}

export async function listStudySubjects(userId: string) {
  const { data, error } = await supabase
    .from('auren_study_subjects')
    .select('id,user_id,name,level,color,icon,notes,status,created_at,updated_at')
    .eq('user_id', userId)
    .eq('status', 'active')
    .is('archived_at', null)
    .order('name', { ascending: true });

  if (error) throw error;
  return ((data ?? []) as StudySubjectRow[]).map(normalizeSubject);
}

export async function listActiveStudyTasks(userId: string, limit = 20) {
  const { data, error } = await supabase
    .from('auren_study_tasks')
    .select(
      'id,user_id,subject_id,topic_id,source,type,title,description,due_at,scheduled_for,priority,status,estimated_minutes,difficulty,confidence,completed_at,created_at,updated_at',
    )
    .eq('user_id', userId)
    .in('status', ['todo', 'in_progress'])
    .is('archived_at', null)
    .order('due_at', { ascending: true, nullsFirst: false })
    .order('updated_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return ((data ?? []) as StudyTaskRow[]).map(normalizeTask);
}

export async function listStudyTaskSteps(userId: string, taskId: string) {
  const { data, error } = await supabase
    .from('auren_study_task_steps')
    .select('id,user_id,task_id,subject_id,topic_id,title,description,order_index,status,estimated_minutes,completed_at,created_at,updated_at')
    .eq('user_id', userId)
    .eq('task_id', taskId)
    .order('order_index', { ascending: true });

  if (error) throw error;
  return ((data ?? []) as StudyTaskStepRow[]).map(normalizeTaskStep);
}

export async function createStudySubject(input: {
  userId: string;
  name: string;
  level?: StudySubject['level'];
  notes?: string;
}) {
  const { data, error } = await supabase
    .from('auren_study_subjects')
    .insert({
      user_id: input.userId,
      name: input.name.trim(),
      level: input.level ?? 'unknown',
      notes: input.notes?.trim() || null,
    })
    .select('id,user_id,name,level,color,icon,notes,status,created_at,updated_at')
    .single();

  if (error) throw error;
  return normalizeSubject(data as StudySubjectRow);
}

export async function createStudyTask(input: {
  userId: string;
  title: string;
  subjectId?: string | null;
  topicId?: string | null;
  description?: string | null;
  type?: StudyTaskType;
  dueAt?: string | null;
  scheduledFor?: string | null;
  priority?: StudyTaskPriority;
  estimatedMinutes?: number | null;
  source?: StudyTask['source'];
}) {
  const { data, error } = await supabase
    .from('auren_study_tasks')
    .insert({
      user_id: input.userId,
      title: input.title.trim(),
      subject_id: input.subjectId ?? null,
      topic_id: input.topicId ?? null,
      description: input.description?.trim() || null,
      type: input.type ?? 'general_goal',
      due_at: input.dueAt ?? null,
      scheduled_for: input.scheduledFor ?? null,
      priority: input.priority ?? 'normal',
      estimated_minutes: input.estimatedMinutes ?? null,
      source: input.source ?? 'manual',
      status: 'todo',
    })
    .select(
      'id,user_id,subject_id,topic_id,source,type,title,description,due_at,scheduled_for,priority,status,estimated_minutes,difficulty,confidence,completed_at,created_at,updated_at',
    )
    .single();

  if (error) throw error;
  return normalizeTask(data as StudyTaskRow);
}

export async function createStudyTaskSteps(input: {
  userId: string;
  taskId: string;
  subjectId?: string | null;
  topicId?: string | null;
  steps: Array<{ title: string; description?: string | null; estimatedMinutes?: number | null }>;
}) {
  if (input.steps.length === 0) return [];

  const rows = input.steps.map((step, index) => ({
    user_id: input.userId,
    task_id: input.taskId,
    subject_id: input.subjectId ?? null,
    topic_id: input.topicId ?? null,
    title: step.title.trim(),
    description: step.description?.trim() || null,
    estimated_minutes: step.estimatedMinutes ?? null,
    order_index: index,
  }));

  const { data, error } = await supabase
    .from('auren_study_task_steps')
    .insert(rows)
    .select('id,user_id,task_id,subject_id,topic_id,title,description,order_index,status,estimated_minutes,completed_at,created_at,updated_at')
    .order('order_index', { ascending: true });

  if (error) throw error;
  return ((data ?? []) as StudyTaskStepRow[]).map(normalizeTaskStep);
}

export async function createOrReplaceTodayFocusCard(input: {
  userId: string;
  focusDate?: string;
  taskId?: string | null;
  stepId?: string | null;
  subjectId?: string | null;
  topicId?: string | null;
  title: string;
  nextStep?: string | null;
  sessionMinutes?: number;
  completedSteps?: number;
  totalSteps?: number;
  selectedBy?: StudyFocusCard['selectedBy'];
  priorityScore?: number;
  reason?: string | null;
  reasonFactors?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}) {
  const focusDate = input.focusDate ?? getLocalDateKey();

  await supabase
    .from('auren_study_focus_cards')
    .update({ status: 'archived' })
    .eq('user_id', input.userId)
    .eq('focus_date', focusDate)
    .in('status', ['active', 'in_progress']);

  const totalSteps = Math.max(input.totalSteps ?? 1, 1);
  const completedSteps = Math.min(Math.max(input.completedSteps ?? 0, 0), totalSteps);

  const { data, error } = await supabase
    .from('auren_study_focus_cards')
    .insert({
      user_id: input.userId,
      focus_date: focusDate,
      task_id: input.taskId ?? null,
      step_id: input.stepId ?? null,
      subject_id: input.subjectId ?? null,
      topic_id: input.topicId ?? null,
      title: input.title.trim(),
      next_step: input.nextStep?.trim() || null,
      session_minutes: input.sessionMinutes ?? 25,
      completed_steps: completedSteps,
      total_steps: totalSteps,
      status: 'active',
      selected_by: input.selectedBy ?? 'user',
      priority_score: input.priorityScore ?? 0,
      reason: input.reason ?? null,
      reason_factors: input.reasonFactors ?? {},
      metadata: input.metadata ?? {},
    })
    .select(
      'id,user_id,focus_date,task_id,step_id,subject_id,topic_id,title,next_step,session_minutes,completed_steps,total_steps,status,selected_by,priority_score,reason,reason_factors,metadata,started_at,completed_at,created_at,updated_at',
    )
    .single();

  if (error) throw error;
  return normalizeFocusCard(data as StudyFocusCardRow);
}

export async function createFocusCardFromTask(input: {
  userId: string;
  task: StudyTask;
  steps?: StudyTaskStep[];
  focusDate?: string;
  selectedBy?: StudyFocusCard['selectedBy'];
  reason?: string | null;
  priorityScore?: number;
}) {
  const steps = input.steps ?? (await listStudyTaskSteps(input.userId, input.task.id));
  const firstOpenStep = steps.find((step) => step.status === 'todo' || step.status === 'in_progress');
  const completedSteps = steps.filter((step) => step.status === 'done').length;
  const totalSteps = Math.max(steps.length, 1);

  return createOrReplaceTodayFocusCard({
    userId: input.userId,
    focusDate: input.focusDate,
    taskId: input.task.id,
    stepId: firstOpenStep?.id ?? null,
    subjectId: input.task.subjectId,
    topicId: input.task.topicId,
    title: input.task.title,
    nextStep: firstOpenStep?.title ?? input.task.description ?? 'Start this study task',
    sessionMinutes: input.task.estimatedMinutes ?? 25,
    completedSteps,
    totalSteps,
    selectedBy: input.selectedBy ?? 'focus_engine',
    priorityScore: input.priorityScore ?? 0,
    reason: input.reason ?? null,
  });
}

export async function markStudyStepDone(input: {
  userId: string;
  stepId: string;
  focusCardId?: string | null;
}) {
  const completedAt = new Date().toISOString();

  const { data, error } = await supabase
    .from('auren_study_task_steps')
    .update({ status: 'done', completed_at: completedAt })
    .eq('id', input.stepId)
    .eq('user_id', input.userId)
    .select('task_id')
    .single();

  if (error) throw error;

  const taskId = (data as { task_id: string }).task_id;
  const steps = await listStudyTaskSteps(input.userId, taskId);
  const completedSteps = steps.filter((step) => step.status === 'done').length;
  const totalSteps = Math.max(steps.length, 1);
  const nextStep = steps.find((step) => step.status === 'todo' || step.status === 'in_progress');

  if (input.focusCardId) {
    await supabase
      .from('auren_study_focus_cards')
      .update({
        completed_steps: completedSteps,
        total_steps: totalSteps,
        step_id: nextStep?.id ?? null,
        next_step: nextStep?.title ?? 'Review your progress',
        status: completedSteps >= totalSteps ? 'completed' : 'active',
        completed_at: completedSteps >= totalSteps ? completedAt : null,
      })
      .eq('id', input.focusCardId)
      .eq('user_id', input.userId);
  }

  return { completedSteps, totalSteps, nextStep };
}

export async function startStudySessionFromFocusCard(input: {
  userId: string;
  focusCard: StudyFocusCard;
}) {
  const startedAt = new Date().toISOString();

  const { data, error } = await supabase
    .from('auren_study_sessions')
    .insert({
      user_id: input.userId,
      subject_id: input.focusCard.subjectId,
      topic_id: input.focusCard.topicId,
      task_id: input.focusCard.taskId,
      step_id: input.focusCard.stepId,
      focus_card_id: input.focusCard.id,
      goal: input.focusCard.nextStep,
      status: 'active',
      session_type: 'focus',
      planned_minutes: input.focusCard.sessionMinutes,
      started_at: startedAt,
      completed_steps: input.focusCard.completedSteps,
      total_steps: input.focusCard.totalSteps,
    })
    .select('id,user_id,subject_id,topic_id,task_id,step_id,focus_card_id,subject,topic,goal,status,planned_minutes,started_at,ended_at,created_at,updated_at')
    .single();

  if (error) throw error;

  if (input.focusCard.id) {
    await supabase
      .from('auren_study_focus_cards')
      .update({ status: 'in_progress', started_at: input.focusCard.startedAt ?? startedAt })
      .eq('id', input.focusCard.id)
      .eq('user_id', input.userId);
  }

  return normalizeSession(data as StudySessionRow);
}

export async function completeStudySession(input: {
  userId: string;
  sessionId: string;
  focusCardId?: string | null;
  completedSteps?: number;
  totalSteps?: number;
  productivityScore?: number | null;
  aiSummary?: string | null;
}) {
  const endedAt = new Date().toISOString();

  const { error } = await supabase
    .from('auren_study_sessions')
    .update({
      status: 'completed',
      ended_at: endedAt,
      completed_steps: input.completedSteps ?? undefined,
      total_steps: input.totalSteps ?? undefined,
      productivity_score: input.productivityScore ?? undefined,
      ai_summary: input.aiSummary ?? undefined,
    })
    .eq('id', input.sessionId)
    .eq('user_id', input.userId);

  if (error) throw error;

  if (input.focusCardId) {
    await supabase
      .from('auren_study_focus_cards')
      .update({
        status: 'completed',
        completed_at: endedAt,
        completed_steps: input.completedSteps ?? undefined,
        total_steps: input.totalSteps ?? undefined,
      })
      .eq('id', input.focusCardId)
      .eq('user_id', input.userId);
  }
}

export async function saveFocusFeedback(input: {
  userId: string;
  focusCardId?: string | null;
  action: 'change_focus' | 'make_easier' | 'make_harder' | 'study_later' | 'mark_done' | 'dismiss' | 'edit' | 'accept';
  note?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const { error } = await supabase.from('auren_study_focus_feedback').insert({
    user_id: input.userId,
    focus_card_id: input.focusCardId ?? null,
    action: input.action,
    note: input.note?.trim() || null,
    metadata: input.metadata ?? {},
  });

  if (error) throw error;
}
