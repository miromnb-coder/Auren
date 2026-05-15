import type { AurenToolResult } from '../../core/types';

export const gmailTool = async (): Promise<AurenToolResult> => {
  return {
    name: 'gmail',
    success: false,
    status: 'not_connected',
    message: 'Gmail is scaffolded but not connected yet.',
  };
};
