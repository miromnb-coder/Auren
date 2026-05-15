import type { AurenToolResult } from '../../core/types';

export const notesTool = async (): Promise<AurenToolResult> => {
  return {
    name: 'notes',
    success: false,
    status: 'not_connected',
    message: 'Notes are scaffolded but not connected yet.',
  };
};
