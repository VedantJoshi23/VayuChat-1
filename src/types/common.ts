export interface StreamEvent {
  type: 'token' | 'tool_call' | 'error' | 'done';
  content: string;
  toolCall?: ToolCall;
  timestamp: number;
}

export interface Response {
  type: 'tool_calling' | 'direct_inference';
  content: string;
  toolCalls?: ToolCall[];
  code?: string;
  executionResult?: ExecutionResult;
  metrics?: InferenceMetrics;
}

export interface InferenceMetrics {
  generationTimeMs: number;
  timeToFirstTokenMs: number;
  outputTokens: number;
  tokensPerSecond: number;
  promptTokens?: number;
}

export interface ExecutionResult {
  stdout: string;
  stderr: string;
  plots: PlotOutput[];
  error: string | null;
  executionTime: number;
}

export interface PlotOutput {
  title: string;
  base64Image: string;
  width: number;
  height: number;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  status: 'pending' | 'executing' | 'completed' | 'failed';
  result?: unknown;
  error?: string;
  metadata?: {
    plots?: unknown[];
  };
}
