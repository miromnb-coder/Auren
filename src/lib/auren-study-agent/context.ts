import { listActiveStudyTasks, listStudySubjects, loadTodayStudyFocusCard } from '../aurenStudyFocus';
import type { StudyAgentContext, StudyAgentInput, StudyAgentRoute } from './types';

function sortUpcomingTasks<T extends { dueAt: string | null; scheduledFor: string | null; updatedAt: string }>(tasks: T[]) {
  return [...tasks].sort((a, b) => {
    const aTime = new Date(a.dueAt ?? a.scheduledFor ?? a.updatedAt).getTime();
    const bTime = new Date(b.dueAt ?? b.scheduledFor ?? b.updatedAt).getTime();
    return aTime - bTime;
  });
}

function createSuggestedNextAction(params: {
  todayFocus: StudyAgentContext['study']['todayFocus'];
  upcomingTasks: StudyAgentContext['study']['upcomingTasks'];
}) {
  if (params.todayFocus && params.todayFocus.status !== 'empty') {
    return `Continue ${params.todayFocus.title}: ${params.todayFocus.nextStep}`;
  }

  const nextTask = params.upcomingTasks[0];
  if (nextTask) {
    return `Start with ${nextTask.title}`;
  }

  return 'Create a study focus for today';
}

export async function buildStudyAgentContext(input: StudyAgentInput, route: StudyAgentRoute): Promise<StudyAgentContext> {
  const userId = input.userId?.trim() || undefined;
  const conversation = input.conversation ?? [];

  if (!userId) {
    return {
      userId,
      message: input.message,
      conversation,
      route,
      study: {
        available: false,
        todayFocus: null,
        subjects: [],
        activeTasks: [],
        upcomingTasks: [],
        suggestedNextAction: 'Create a study focus for today',
      },
      environment: {
        now: new Date().toISOString(),
        platform: 'native',
      },
    };
  }

  try {
    const [todayFocus, subjects, activeTasks] = await Promise.all([
      loadTodayStudyFocusCard(userId),
      listStudySubjects(userId),
      listActiveStudyTasks(userId, 12),
    ]);
    const upcomingTasks = sortUpcomingTasks(activeTasks).slice(0, 5);

    return {
      userId,
      message: input.message,
      conversation,
      route,
      study: {
        available: true,
        todayFocus,
        subjects,
        activeTasks,
        upcomingTasks,
        suggestedNextAction: createSuggestedNextAction({ todayFocus, upcomingTasks }),
      },
      environment: {
        now: new Date().toISOString(),
        platform: 'native',
      },
    };
  } catch {
    return {
      userId,
      message: input.message,
      conversation,
      route,
      study: {
        available: false,
        todayFocus: null,
        subjects: [],
        activeTasks: [],
        upcomingTasks: [],
        suggestedNextAction: 'Create a study focus for today',
      },
      environment: {
        now: new Date().toISOString(),
        platform: 'native',
      },
    };
  }
}
