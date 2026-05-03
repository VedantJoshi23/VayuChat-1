import { Message } from '../../types/chat';

export interface Tokenizer {
  encode(text: string): number[];
  decode(tokens: number[]): string;
  getTokenCount(text: string): number;
}

// Simple approximation tokenizer (1 token ≈ 4 characters)
class SimpleTokenizer implements Tokenizer {
  private tokensPerChar = 0.25; // Average tokens per character

  encode(text: string): number[] {
    // This is a placeholder - real implementation would use actual tokenization
    const count = Math.ceil(text.length * this.tokensPerChar);
    return Array.from({ length: count }, (_, i) => i);
  }

  decode(tokens: number[]): string {
    // Placeholder - in real implementation, would decode tokens back to text
    return `[${tokens.length} tokens]`;
  }

  getTokenCount(text: string): number {
    return Math.ceil(text.length * this.tokensPerChar);
  }
}

export class TokenizerRegistry {
  private tokenizers: Map<string, Tokenizer> = new Map();
  private defaultTokenizer = new SimpleTokenizer();

  constructor() {
    // Register tokenizers for different model families
    const simple = new SimpleTokenizer();
    this.registerTokenizer('default', simple);
    this.registerTokenizer('llama', simple);
    this.registerTokenizer('mistral', simple);
    this.registerTokenizer('phi', simple);
  }

  registerTokenizer(modelName: string, tokenizer: Tokenizer): void {
    this.tokenizers.set(modelName.toLowerCase(), tokenizer);
  }

  getTokenizer(modelName: string): Tokenizer {
    const name = modelName.toLowerCase();
    return this.tokenizers.get(name) || this.defaultTokenizer;
  }

  /**
   * Calculate total tokens for a conversation context
   */
  calculateContextTokens(messages: Message[]): number {
    const tokenizer = this.defaultTokenizer;
    let totalTokens = 0;

    for (const message of messages) {
      totalTokens += tokenizer.getTokenCount(message.content);
      // Add overhead for role/formatting (roughly 4 tokens per message)
      totalTokens += 4;
    }

    return totalTokens;
  }

  /**
   * Trim messages to fit within context window
   */
  trimMessagesToFit(
    messages: Message[],
    maxContextTokens: number,
    reserveForResponse: number = 512
  ): Message[] {
    const tokenizer = this.defaultTokenizer;
    const available = maxContextTokens - reserveForResponse;

    let totalTokens = 0;
    const result: Message[] = [];

    // Add messages from end to beginning to keep most recent context
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      const msgTokens = tokenizer.getTokenCount(msg.content) + 4; // +4 for overhead

      if (totalTokens + msgTokens <= available) {
        result.unshift(msg);
        totalTokens += msgTokens;
      } else {
        break;
      }
    }

    return result;
  }

  /**
   * Estimate tokens in a prompt
   */
  estimatePromptTokens(prompt: string): number {
    return this.defaultTokenizer.getTokenCount(prompt);
  }
}

// Singleton instance
export const tokenizerRegistry = new TokenizerRegistry();
