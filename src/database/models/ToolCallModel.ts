import { Model } from '@nozbe/watermelondb';
import { field, text } from '@nozbe/watermelondb/decorators';

export default class ToolCallModel extends Model {
  static table = 'tool_calls';

  @text('message_id') messageId?: string;
  @text('name') name?: string;
  @text('arguments') arguments?: string;
  @text('status') status?: 'pending' | 'executing' | 'completed' | 'failed';
  @text('result') result?: string;
  @text('error') error?: string;
  @field('timestamp') timestamp?: number;
  @field('execution_time') executionTime?: number;

  getParsedArguments() {
    try {
      return this.arguments ? JSON.parse(this.arguments) : {};
    } catch {
      return {};
    }
  }

  getParsedResult() {
    try {
      return this.result ? JSON.parse(this.result) : null;
    } catch {
      return this.result;
    }
  }
}
