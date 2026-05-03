import { Model } from '@nozbe/watermelondb';
import { field, text } from '@nozbe/watermelondb/decorators';

export default class ConversationModel extends Model {
  static table = 'conversations';

  @text('title') title?: string;
  @field('created_at') createdAt?: number;
  @field('updated_at') updatedAt?: number;
  @text('model_used') modelUsed?: string;
  @text('mode') mode?: 'tool_calling' | 'direct_inference';
  @field('message_count') messageCount?: number;
  @text('system_prompt') systemPrompt?: string;
  @field('archived') archived?: boolean;
}
