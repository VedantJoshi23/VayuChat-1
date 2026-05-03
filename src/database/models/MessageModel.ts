import { Model } from '@nozbe/watermelondb';
import { field, text, children } from '@nozbe/watermelondb/decorators';

export default class MessageModel extends Model {
  static table = 'messages';
  static associations = {
    tool_calls: { type: 'has_many' as const, foreignKey: 'message_id' },
  };

  @text('conversation_id') conversationId?: string;
  @text('role') role?: 'user' | 'assistant' | 'system';
  @text('content') content?: string;
  @field('timestamp') timestamp?: number;
  @text('parent_message_id') parentMessageId?: string;
  @field('execution_time') executionTime?: number;
  @field('plots_count') plotsCount?: number;
  @text('metadata') metadata?: string;

  @children('tool_calls') toolCalls?: any;
}
