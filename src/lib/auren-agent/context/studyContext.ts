import { supabase } from '../../supabase';
import type { AurenAgentInput } from '../core/types';

const MAX_SUBJECTS = 8;
const MAX_TASKS = 8;
const MAX_STEPS = 6;
const MAX_SESSIONS = 5;
const MAX_SKILLS = 8;

type FocusCardRow = {
  id: string;
  focus_date: string;
  task_id: string | null;
  step_id: string | null;
  subject_id: string | null;
  topic_id: string | null;
  title: string;
  next_step: string | null;
  session_minutes: number | null;
  completed_steps: number | null;
  total_steps: number | null;
  status: string;
  selected_by: string | null;
  priority_score: number | null;
  reason: string | null;
  updated_at: string;
};

type SubjectRow = {
  id: string;
  name: string;
  level: string | null;
  status: string;
  updated_at: string;
};

type TaskRow = {
  id: string;
  subject_id: string | null;
  topic_id: string | null;
  type: string;
  title: string;
  description: string | null;
  due_at: string | null;
  scheduled_for: string | null;
  priority: string;
  status: string;
  estimated_minutes: number | null;
  difficulty: string | null;
  updated_at: string;
};

type StepRow = {
  id: string;
  task_id: string;
  title: string;
  status: string;
  estimated_minutes: number | null;
  order_index: number;
  completed_at: string | null;
};

type SessionRow = {
  id: string;
  subject_id: string | null;
  task_id: string | null;
  focus_card_id: string | null;
  goal: string | null;
  status: string;
  planned_minutes: number | null;
  actual_minutes: number | null;
  completed_steps: number | null;
  total_steps: number | null;
  productivity_score: number | null;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
};

type SkillRow = {
  id: string;
  subject_id: string | null;
  topic_id: string | null;
  name: string;
  mastery_score: number | null;
  confidence: number | null;
  correct_count: number | null;
  mistake_count: number | null;
  status: string;
  last_practiced_at: string | null;
  updated_at: string;
};

export type AurenStudyContext = {
  available: boolean;
  note?: string;
  todayFocus: {
    id: string;
    date: string;
    title: string;
    nextStep: string;
    sessionMinutes: number;
    completedSteps: number;
    totalSteps: number;
    progress: number;
    status: string;
    selectedBy: string | null;
    priorityScore: number;
    reason: string | null;
  } | null;
  subjects: Array<{
    id: string;
    name: string;
    level: string;
    status: string;
  }>;
  activeTasks: Array<{
    id: string;
    subjectId: string | null;
    topicId: string | null;
    type: string;
    title: string;
    description: string | null;
    dueAt: string | null;
    scheduledFor: string | null;
    priority: string;
    status: string;
    estimatedMinutes: number | null;
    difficulty: string;
  }>;
  openSteps: Array<{
    id: string;
    taskId: string;
    title: string;
    status: string;
    estimatedMinutes: number | null;
    orderIndex: number;
  }>;
  recentSessions: Array<{
    id: string;
    subjectId: string | null;
    taskId: string | null;
    focusCardId: string | null;
    goal: string | null;
    status: string;
    plannedMinutes: number | null;
    actualMinutes: number | null;
    completedSteps: number | null;
    totalSteps: number | null;
    productivityScore: number | null;
    startedAt: string | null;
    endedAt: string | null;
  }>;
  skillAreas: Array<{
    id: string;
    subjectId: string | null;
    topicId: string | null;
    name: string;
    masteryScore: number;
    confidence: number;
    correctCount: number;
    mistakeCount: number;
    status: string;
    lastPracticedAt: string | null;
  }>;
  summary: {
    hasFocus: boolean;
    activeTaskCount: number;
    upcomingDeadlineCount: number;
    weakAreaCount: number;
    suggestedNextAction: string;
  };
};

function clampProgress(completedSteps: number, totalSteps: number) {
  if (totalSteps <= 0) return 0;
  return Math.min(Math.max(completedSteps / totalSteps, 0), 1);
}

function getDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normalizeFocus(row: FocusCardRow | null): AurenStudyContext['todayFocus'] {
  if (!row) return null;

  const totalSteps = Math.max(row.total_steps ?? 1, 1);
  const completedSteps = Math.min(Math.max(row.completed_steps ?? 0, 0), totalSteps);

  return {
    id: row.id,
    date: row.focus_date,
    title: row.title,
    nextStep: row.next_step?.trim() || 'Start your next study step',
    sessionMinutes: row.session_minutes ?? 25,
    completedSteps,
    totalSteps,
    progress: clampProgress(completedSteps, totalSteps),
    status: row.status,
    selectedBy: row.selected_by,
    priorityScore: row.priority_score ?? 0,
    reason: row.reason,
  };
}

function getSuggestedNextAction(context: Pick<AurenStudyContext, 'todayFocus' | 'activeTasks' | 'openSteps'>) {
  if (context.todayFocus) {
    return `Use today’s focus: ${context.todayFocus.title}. Next step: ${context.todayFocus.nextStep}.`;
  }

  const firstOpenStep = context.openSteps[0];
  const firstTask = context.activeTasks[0];

  if (firstOpenStep && firstTask) {
    return `Start the next open step: ${firstOpenStep.title} from ${firstTask.title}.`;
  }

  if (firstTask) {
    return `Start the active task: ${firstTask.title}.`;
  }

  return 'Ask the user to set a study focus or add their first subject, task, or exam.';
}

function createEmptyStudyContext(note?: string): AurenStudyContext {
  return {
    available: false,
    ...(note ? { note } : {}),
    todayFocus: null,
    subjects: [],
    activeTasks: [],
    openSteps: [],
    recentSessions: [],
    skillAreas: [],
    summary: {
      hasFocus: false,
      activeTaskCount: 0,
      upcomingDeadlineCount: 0,
      weakAreaCount: 0,
      suggestedNextAction: 'Ask the user to set a study focus or add their first subject, task, or exam.',
    },
  };
}

export async function getStudyContext(input: AurenAgentInput): Promise<AurenStudyContext> {
  const userId = input.userId?.trim();

  if (!userId) {
    return createEmptyStudyContext('No authenticated user id was available for study context.');
  }

  const today = getDateKey();

  try {
    const focusQuery = supabase
      .from('auren_study_focus_cards')
      .select('id,focus_date,task_id,step_id,subject_id,topic_id,title,next_step,session_minutes,completed_steps,total_steps,status,selected_by,priority_score,reason,updated_at')
      .eq('user_id', userId)
      .eq('focus_date', today)
      .in('status', ['active', 'in_progress', 'completed'])
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const subjectsQuery = supabase
      .from('auren_study_subjects')
      .select('id,name,level,status,updated_at')
      .eq('user_id', userId)
      .eq('status', 'active')
      .is('archived_at', null)
      .order('updated_at', { ascending: false })
      .limit(MAX_SUBJECTS);

    const tasksQuery = supabase
      .from('auren_study_tasks')
      .select('id,subject_id,topic_id,type,title,description,due_at,scheduled_for,priority,status,estimated_minutes,difficulty,updated_at')
      .eq('user_id', userId)
      .in('status', ['todo', 'in_progress'])
      .is('archived_at', null)
      .order('due_at', { ascending: true, nullsFirst: false })
      .order('updated_at', { ascending: false })
      .limit(MAX_TASKS);

    const stepsQuery = supabase
      .from('auren_study_task_steps')
      .select('id,task_id,title,status,estimated_minutes,order_index,completed_at')
      .eq('user_id', userId)
      .in('status', ['todo', 'in_progress'])
      .order('order_index', { ascending: true })
      .limit(MAX_STEPS);

    const sessionsQuery = supabase
      .from('auren_study_sessions')
      .select('id,subject_id,task_id,focus_card_id,goal,status,planned_minutes,actual_minutes,completed_steps,total_steps,productivity_score,started_at,ended_at,created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(MAX_SESSIONS);

    const skillsQuery = supabase
      .from('auren_study_skill_areas')
      .select('id,subject_id,topic_id,name,mastery_score,confidence,correct_count,mistake_count,status,last_practiced_at,updated_at')
      .eq('user_id', userId)
      .in('status', ['new', 'learning', 'needs_review'])
      .order('mastery_score', { ascending: true })
      .limit(MAX_SKILLS);

    const [focusResult, subjectsResult, tasksResult, stepsResult, sessionsResult, skillsResult] = await Promise.all([
      focusQuery,
      subjectsQuery,
      tasksQuery,
      stepsQuery,
      sessionsQuery,
      skillsQuery,
    ]);

    const todayFocus = normalizeFocus((focusResult.data as FocusCardRow | null) ?? null);
    const subjects = ((subjectsResult.data ?? []) as SubjectRow[]).map((subject) => ({
      id: subject.id,
      name: subject.name,
      level: subject.level ?? 'unknown',
      status: subject.status,
    }));
    const activeTasks = ((tasksResult.data ?? []) as TaskRow[]).map((task) => ({
      id: task.id,
      subjectId: task.subject_id,
      topicId: task.topic_id,
      type: task.type,
      title: task.title,
      description: task.description,
      dueAt: task.due_at,
      scheduledFor: task.scheduled_for,
      priority: task.priority,
      status: task.status,
      estimatedMinutes: task.estimated_minutes,
      difficulty: task.difficulty ?? 'unknown',
    }));
    const openSteps = ((stepsResult.data ?? []) as StepRow[]).map((step) => ({
      id: step.id,
      taskId: step.task_id,
      title: step.title,
      status: step.status,
      estimatedMinutes: step.estimated_minutes,
      orderIndex: step.order_index,
    }));
    const recentSessions = ((sessionsResult.data ?? []) as SessionRow[]).map((session) => ({
      id: session.id,
      subjectId: session.subject_id,
      taskId: session.task_id,
      focusCardId: session.focus_card_id,
      goal: session.goal,
      status: session.status,
      plannedMinutes: session.planned_minutes,
      actualMinutes: session.actual_minutes,
      completedSteps: session.completed_steps,
      totalSteps: session.total_steps,
      productivityScore: session.productivity_score,
      startedAt: session.started_at,
      endedAt: session.ended_at,
    }));
    const skillAreas = ((skillsResult.data ?? []) as SkillRow[]).map((skill) => ({
      id: skill.id,
      subjectId: skill.subject_id,
      topicId: skill.topic_id,
      name: skill.name,
      masteryScore: skill.mastery_score ?? 0,
      confidence: skill.confidence ?? 0,
      correctCount: skill.correct_count ?? 0,
      mistakeCount: skill.mistake_count ?? 0,
      status: skill.status,
      lastPracticedAt: skill.last_practiced_at,
    }));

    const upcomingDeadlineCount = activeTasks.filter((task) => Boolean(task.dueAt)).length;
    const weakAreaCount = skillAreas.filter((skill) => skill.status === 'needs_review' || skill.masteryScore < 0.45).length;
    const suggestedNextAction = getSuggestedNextAction({ todayFocus, activeTasks, openSteps });

    return {
      available: true,
      todayFocus,
      subjects,
      activeTasks,
      openSteps,
      recentSessions,
      skillAreas,
      summary: {
        hasFocus: Boolean(todayFocus),
        activeTaskCount: activeTasks.length,
        upcomingDeadlineCount,
        weakAreaCount,
        suggestedNextAction,
      },
    };
  } catch {
    return createEmptyStudyContext('Study context could not be loaded. Answer normally and ask for study details if needed.');
  }
}
