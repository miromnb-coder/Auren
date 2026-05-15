import type { AurenToolResult } from '../../core/types';

export const calendarTool = async (): Promise<AurenToolResult> => {
  return {
    name: 'calendar',
    success: false,
    status: 'not_connected',
    message: 'Calendar is scaffolded but not connected yet.',
  };
};
