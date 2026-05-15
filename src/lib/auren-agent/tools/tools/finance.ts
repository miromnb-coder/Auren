import type { AurenToolResult } from '../../core/types';

export const financeTool = async (): Promise<AurenToolResult> => {
  return {
    name: 'finance',
    success: false,
    status: 'not_connected',
    message: 'Finance is scaffolded but not connected yet.',
  };
};
