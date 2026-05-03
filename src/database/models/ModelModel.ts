import { Model } from '@nozbe/watermelondb';
import { field, text } from '@nozbe/watermelondb/decorators';

export default class ModelModel extends Model {
  static table = 'models';

  @text('name') name?: string;
  @text('path') path?: string;
  @text('format') format?: 'gguf' | 'pte' | 'onnx';
  @field('size') size?: number;
  @field('context_window') contextWindow?: number;
  @field('temperature') temperature?: number;
  @field('max_tokens') maxTokens?: number;
  @text('tokenizer_path') tokenizerPath?: string;
  @text('quantization') quantization?: string;
  @text('metadata') metadata?: string;
  @field('last_used') lastUsed?: number;
  @field('created_at') createdAt?: number;

  getParsedMetadata() {
    try {
      return this.metadata ? JSON.parse(this.metadata) : null;
    } catch {
      return null;
    }
  }
}
