import { tableSchema } from '@nozbe/watermelondb';

export const conversationsSchema = tableSchema({
  name: 'conversations',
  columns: [
    { name: 'title', type: 'string' },
    { name: 'created_at', type: 'number' },
    { name: 'updated_at', type: 'number' },
    { name: 'model_used', type: 'string' },
    { name: 'mode', type: 'string' },
    { name: 'message_count', type: 'number', isOptional: true },
    { name: 'system_prompt', type: 'string', isOptional: true },
    { name: 'archived', type: 'boolean', isOptional: true },
  ],
});

export const messagesSchema = tableSchema({
  name: 'messages',
  columns: [
    { name: 'conversation_id', type: 'string', isIndexed: true },
    { name: 'role', type: 'string' },
    { name: 'content', type: 'string' },
    { name: 'timestamp', type: 'number', isIndexed: true },
    { name: 'parent_message_id', type: 'string', isOptional: true },
    { name: 'execution_time', type: 'number', isOptional: true },
    { name: 'plots_count', type: 'number', isOptional: true },
    { name: 'metadata', type: 'string', isOptional: true },
  ],
});

export const toolCallsSchema = tableSchema({
  name: 'tool_calls',
  columns: [
    { name: 'message_id', type: 'string', isIndexed: true },
    { name: 'name', type: 'string' },
    { name: 'arguments', type: 'string' },
    { name: 'status', type: 'string', isIndexed: true },
    { name: 'result', type: 'string', isOptional: true },
    { name: 'error', type: 'string', isOptional: true },
    { name: 'timestamp', type: 'number' },
    { name: 'execution_time', type: 'number', isOptional: true },
  ],
});

export const modelsSchema = tableSchema({
  name: 'models',
  columns: [
    { name: 'name', type: 'string' },
    { name: 'path', type: 'string' },
    { name: 'format', type: 'string' },
    { name: 'size', type: 'number', isOptional: true },
    { name: 'context_window', type: 'number', isOptional: true },
    { name: 'temperature', type: 'number', isOptional: true },
    { name: 'max_tokens', type: 'number', isOptional: true },
    { name: 'tokenizer_path', type: 'string', isOptional: true },
    { name: 'quantization', type: 'string', isOptional: true },
    { name: 'metadata', type: 'string', isOptional: true },
    { name: 'last_used', type: 'number', isOptional: true },
    { name: 'created_at', type: 'number' },
  ],
});

export const executionLogsSchema = tableSchema({
  name: 'execution_logs',
  columns: [
    { name: 'message_id', type: 'string', isOptional: true },
    { name: 'code', type: 'string', isOptional: true },
    { name: 'stdout', type: 'string', isOptional: true },
    { name: 'stderr', type: 'string', isOptional: true },
    { name: 'plots_count', type: 'number', isOptional: true },
    { name: 'error', type: 'string', isOptional: true },
    { name: 'execution_time', type: 'number', isOptional: true },
    { name: 'timestamp', type: 'number' },
  ],
});
