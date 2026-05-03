import { BaseLLMEngine } from './LLMEngine';
import { Response, StreamEvent, ToolCall } from '../../types/common';
import { v4 as uuidv4 } from 'uuid';
import * as llamaRNBridge from './llamaRNBridge';
import { FunctionCall } from '../dataOperations/DataFrameManager';

export class ToolCallingEngine extends BaseLLMEngine {
  async initialize(config: any): Promise<void> {
    await super.initialize(config);
  }

  async generate(
    prompt: string,
    onStream: (event: StreamEvent) => void,
    abortSignal?: AbortSignal
  ): Promise<Response> {
    if (!this.isReady()) {
      throw new Error('ToolCallingEngine not initialized');
    }

    const result = await llamaRNBridge.generate(
      prompt,
      {
        temperature: this.config?.temperature ?? 0.2,
        maxTokens: this.config?.maxTokens ?? 1024,
        topK: this.config?.topK ?? 40,
        topP: this.config?.topP ?? 0.9,
        stop: ['</function_calls>', '<|end|>', '<|im_end|>', '<end_of_turn>', '</s>'],
      },
      (token) => {
        onStream({ type: 'token', content: token, timestamp: Date.now() });
      },
      abortSignal
    );

    // Ensure we have the closing tag if the model stopped at it
    const fullText = result.text.includes('</function_calls>')
      ? result.text
      : result.text + '</function_calls>';

    const parsed = parseFunctionCalls(fullText);

    return {
      type: 'tool_calling',
      content: fullText,
      toolCalls: parsed.map((fc) => functionCallToToolCall(fc)),
      metrics: {
        generationTimeMs: result.generationTimeMs,
        timeToFirstTokenMs: result.timeToFirstTokenMs,
        outputTokens: result.outputTokens,
        tokensPerSecond: result.tokensPerSecond,
      },
    };
  }

  async unload(): Promise<void> {
    await super.unload();
  }
}

/**
 * Parse <function_calls>[...]</function_calls> from model output.
 * Handles both JSON (double quotes) and Python-dict (single quotes) formats.
 */
export function parseFunctionCalls(text: string): FunctionCall[] {
  // Try extracting from <function_calls> tag first
  const tagMatch = text.match(/<function_calls>\s*([\s\S]*?)\s*(?:<\/function_calls>|$)/);
  const raw = tagMatch ? tagMatch[1].trim() : text.trim();

  if (!raw || !raw.startsWith('[')) return [];

  // 1. Try strict JSON
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as FunctionCall[];
  } catch {}

  // 2. Convert Python-dict single quotes → JSON double quotes
  try {
    const jsonified = raw
      .replace(/'/g, '"')
      .replace(/\bTrue\b/g, 'true')
      .replace(/\bFalse\b/g, 'false')
      .replace(/\bNone\b/g, 'null');
    const parsed = JSON.parse(jsonified);
    if (Array.isArray(parsed)) return parsed as FunctionCall[];
  } catch {}

  return [];
}

function functionCallToToolCall(fc: FunctionCall): ToolCall {
  return {
    id: uuidv4(),
    name: fc.function,
    arguments: fc.args ?? {},
    status: 'pending',
  };
}
