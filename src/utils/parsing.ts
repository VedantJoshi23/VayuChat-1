import { ToolCall } from '../types/common';
import { v4 as uuidv4 } from 'uuid';

/**
 * Extract tool calls from model response text
 */
export function extractToolCalls(responseText: string): ToolCall[] {
  const toolCalls: ToolCall[] = [];

  // Pattern 1: JSON array of tool calls
  const jsonMatch = responseText.match(/\[[\s\S]*?\{[\s\S]*?\}[\s\S]*?\]/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed)) {
        return parsed.map((tc: any) => ({
          id: uuidv4(),
          name: tc.tool || tc.name || '',
          arguments: tc.args || tc.arguments || {},
          status: 'pending' as const,
          timestamp: Date.now(),
        }));
      }
    } catch {
      // Continue to other patterns
    }
  }

  // Pattern 2: Individual function calls like func_name(arg1, arg2)
  const funcRegex = /(\w+)\s*\(\s*({[\s\S]*?}|[\s\S]*?)\s*\)/g;
  let match;
  while ((match = funcRegex.exec(responseText)) !== null) {
    const funcName = match[1];
    const argsStr = match[2];

    try {
      const args = JSON.parse(argsStr);
      toolCalls.push({
        id: uuidv4(),
        name: funcName,
        arguments: typeof args === 'object' ? args : { value: argsStr },
        status: 'pending',
        timestamp: Date.now(),
      });
    } catch {
      // Skip invalid JSON
    }
  }

  return toolCalls;
}

/**
 * Extract Python code blocks from response
 */
export function extractCodeBlocks(
  responseText: string
): Array<{ language: string; code: string }> {
  const blocks: Array<{ language: string; code: string }> = [];

  // Match markdown code blocks
  const codeRegex = /```(\w+)?\n([\s\S]*?)```/g;
  let match;

  while ((match = codeRegex.exec(responseText)) !== null) {
    blocks.push({
      language: match[1] || 'text',
      code: match[2].trim(),
    });
  }

  return blocks;
}

/**
 * Validate JSON string
 */
export function isValidJSON(str: string): boolean {
  try {
    JSON.parse(str);
    return true;
  } catch {
    return false;
  }
}
