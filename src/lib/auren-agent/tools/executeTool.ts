import type { AurenToolCall, AurenToolResult } from '../core/types';

export const executeTool = async (toolCall: AurenToolCall): Promise<AurenToolResult> => {
  return {
    name: toolCall.name,
    success: false,
    status: 'not_connected',
    message: `${toolCall.name} is scaffolded but not connected yet.`,
  };
};

export const executeTools = async (
  toolCalls: AurenToolCall[],
): Promise<AurenToolResult[]> => {
  if (toolCalls.length === 0) {
    return [];
  }

  return Promise.all(toolCalls.map((toolCall) => executeTool(toolCall)));
};
