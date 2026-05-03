import { Model } from '@nozbe/watermelondb';
import { field, text } from '@nozbe/watermelondb/decorators';

export default class ExecutionLogModel extends Model {
  static table = 'execution_logs';

  @text('message_id') messageId?: string;
  @text('code') code?: string;
  @text('stdout') stdout?: string;
  @text('stderr') stderr?: string;
  @field('plots_count') plotsCount?: number;
  @text('error') error?: string;
  @field('execution_time') executionTime?: number;
  @field('timestamp') timestamp?: number;
}
