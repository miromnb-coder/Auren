import type { AurenToolDefinition } from '../core/types';

export const AUREN_TOOL_REGISTRY: AurenToolDefinition[] = [
  {
    name: 'calendar',
    label: 'Calendar',
    description: 'Calendar integration placeholder for future scheduling and daily context.',
    status: 'placeholder',
  },
  {
    name: 'gmail',
    label: 'Gmail',
    description: 'Email integration placeholder for future inbox and message intelligence.',
    status: 'placeholder',
  },
  {
    name: 'tasks',
    label: 'Tasks',
    description: 'Task integration placeholder for future reminders and todo actions.',
    status: 'placeholder',
  },
  {
    name: 'notes',
    label: 'Notes',
    description: 'Notes integration placeholder for future note creation and retrieval.',
    status: 'placeholder',
  },
  {
    name: 'study',
    label: 'Study',
    description: 'Study helper placeholder for future plans, quizzes, and explanations.',
    status: 'placeholder',
  },
  {
    name: 'finance',
    label: 'Finance',
    description: 'Finance integration placeholder for future spending and subscription analysis.',
    status: 'placeholder',
  },
];

export const getAvailableTools = (): AurenToolDefinition[] => {
  return AUREN_TOOL_REGISTRY;
};
