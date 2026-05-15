import type { AurenToolResult } from '../../core/types';

export const tasksTool = async (): Promise<AurenToolResult> => {
  return {
    name: 'tasks',
    success: false,
    status: 'not_connected',
    message: 'Tasks are scaffolded but not connected yet.',
  };
};
