import type { AurenToolResult } from '../../core/types';

export const studyTool = async (): Promise<AurenToolResult> => {
  return {
    name: 'study',
    success: false,
    status: 'placeholder',
    message: 'Study tool is scaffolded. Real study plans, quizzes, and explanations can be connected later.',
  };
};
