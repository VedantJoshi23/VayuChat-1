import { Message, Conversation } from '../../types/chat';
import { tokenizerRegistry } from '../llmEngine/tokenizerRegistry';
import type { RNLlamaOAICompatibleMessage } from '../llmEngine/llamaRNBridge';

export interface ContextBuildOptions {
  maxContextMessages?: number;
  maxContextTokens?: number;
  reserveForResponse?: number;
  includeSystemPrompt?: boolean;
}

const DEFAULT_OPTIONS: ContextBuildOptions = {
  maxContextMessages: 20,
  maxContextTokens: 4096,
  reserveForResponse: 512,
  includeSystemPrompt: true,
};

/**
 * Builds a prompt with conversation context for the LLM
 */
export function buildContextPrompt(
  userQuery: string,
  messages: Message[],
  conversation: Conversation,
  options: ContextBuildOptions = {}
): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Limit number of context messages
  let contextMessages = messages;
  if (opts.maxContextMessages && messages.length > opts.maxContextMessages) {
    contextMessages = messages.slice(-opts.maxContextMessages);
  }

  // Trim to fit within token limit
  if (opts.maxContextTokens) {
    contextMessages = tokenizerRegistry.trimMessagesToFit(
      contextMessages,
      opts.maxContextTokens,
      opts.reserveForResponse
    );
  }

  // Build the prompt
  let prompt = '';

  // Add system prompt if available
  if (opts.includeSystemPrompt && conversation.systemPrompt) {
    prompt += `${conversation.systemPrompt}\n\n`;
  }

  // Add conversation history
  if (contextMessages.length > 0) {
    prompt += '## Previous conversation:\n';
    for (const msg of contextMessages) {
      const role = msg.role === 'user' ? 'User' : 'Assistant';
      prompt += `${role}: ${msg.content}\n`;
    }
    prompt += '\n';
  }

  // Add current query
  prompt += `## New query:\nUser: ${userQuery}\n\nAssistant:`;

  return prompt;
}

export interface TableSchema {
  name: string;
  columns: string[];
  rowCount: number;
}

/**
 * Builds a system prompt for tool calling mode.
 * Matches the notebook's DataFrameManager function signatures exactly.
 */
export function buildToolCallingSystemPrompt(tables: TableSchema[] = []): string {
  const tableSection =
    tables.length > 0
      ? `Available tables:\n${tables
          .map((t) => `  - "${t.name}": ${t.rowCount} rows, columns: [${t.columns.join(', ')}]`)
          .join('\n')}`
      : 'No datasets loaded yet. Ask the user to load a dataset first.';

  return `You are an AI assistant specialized in air quality data analysis.

${tableSection}

You have access to the following data operations:
- load_table(table: str) — set current working table
- filter_rows(column: str, operator: str, value) — operators: ==, !=, >, >=, <, <=, contains, in
- filter_date_range(column: str, start_date: str, end_date: str) — format: YYYY-MM-DD
- aggregate(group_by: list[str], aggregations: dict[str,str]) — funcs: mean, sum, min, max, count, std, median
- sort_values(column: str, ascending: bool)
- top_k(k: int, column: str) — sort descending, take top k
- bottom_k(k: int, column: str) — sort ascending, take bottom k
- count_rows()
- get_value(row_index: int, column: str) — extract a single cell after sorting/filtering
- join_table(right_table: str, on: str|list[str], how: str)

IMPORTANT: Respond ONLY with a <function_calls> block. No other text.

Format:
<function_calls>
[{"function": "load_table", "args": {"table": "data"}}, {"function": "get_value", "args": {"row_index": 0, "column": "City"}}]
</function_calls>

Example — "Which city had the highest PM2.5 in 2024?":
<function_calls>
[{"function": "load_table", "args": {"table": "data"}}, {"function": "filter_rows", "args": {"column": "Year", "operator": "==", "value": 2024}}, {"function": "aggregate", "args": {"group_by": ["City"], "aggregations": {"PM2.5 (µg/m³)": "mean"}}}, {"function": "sort_values", "args": {"column": "PM2.5 (µg/m³)", "ascending": false}}, {"function": "get_value", "args": {"row_index": 0, "column": "City"}}]
</function_calls>`;
}

/**
 * Builds a system prompt for direct inference mode (code generation)
 */
export function buildDirectInferenceSystemPrompt(): string {
  return `You are an expert Python data analyst specializing in air quality analysis.

You have access to:
- pandas (pd) - Data manipulation
- numpy (np) - Numerical computing
- matplotlib (plt) - Visualization
- air quality datasets in common formats

When the user asks a question about air quality:
1. Write Python code to analyze the data
2. Generate visualizations where appropriate
3. Provide insights based on the analysis

Guidelines:
- Start with loading/preparing data
- Use clear variable names
- Add comments explaining the analysis
- Generate plots for key findings
- Handle missing data gracefully

Example:
\`\`\`python
import pandas as pd
import matplotlib.pyplot as plt

# Load air quality data
df = pd.read_csv('air_quality.csv')

# Analyze PM2.5 trends
monthly_pm25 = df.groupby('month')['pm25'].mean()
monthly_pm25.plot(kind='bar')
plt.title('Monthly PM2.5 Levels')
plt.show()
\`\`\``;
}

/**
 * Builds an OpenAI-compatible message array for use with llama.rn's
 * `getFormattedChat()` / `generateChat()`.  This lets the model apply its
 * own Jinja chat template instead of the hand-crafted raw-string format.
 */
export function buildOAIMessages(
  userQuery: string,
  messages: Message[],
  conversation: Conversation,
  opts: ContextBuildOptions = {}
): RNLlamaOAICompatibleMessage[] {
  const merged = { ...DEFAULT_OPTIONS, ...opts };

  // Trim history to fit context budget (same logic as buildContextPrompt)
  let history = messages;
  if (merged.maxContextMessages && history.length > merged.maxContextMessages) {
    history = history.slice(-merged.maxContextMessages);
  }
  if (merged.maxContextTokens) {
    history = tokenizerRegistry.trimMessagesToFit(
      history,
      merged.maxContextTokens,
      merged.reserveForResponse
    );
  }

  const result: RNLlamaOAICompatibleMessage[] = [];

  if (merged.includeSystemPrompt && conversation.systemPrompt) {
    result.push({ role: 'system', content: conversation.systemPrompt });
  }

  for (const msg of history) {
    if (msg.role === 'user' || msg.role === 'assistant') {
      result.push({ role: msg.role, content: msg.content });
    }
  }

  result.push({ role: 'user', content: userQuery });

  return result;
}

/**
 * Estimates the conversation length in tokens
 */
export function estimateConversationTokens(messages: Message[]): number {
  return tokenizerRegistry.calculateContextTokens(messages);
}

/**
 * Gets the number of messages that fit within the context window
 */
export function getContextWindowFit(
  messages: Message[],
  contextWindowSize: number,
  reserveForResponse: number = 512
): {
  fittingMessages: Message[];
  fittingTokens: number;
  totalTokens: number;
} {
  const totalTokens = tokenizerRegistry.calculateContextTokens(messages);
  const fittingMessages = tokenizerRegistry.trimMessagesToFit(
    messages,
    contextWindowSize,
    reserveForResponse
  );
  const fittingTokens = tokenizerRegistry.calculateContextTokens(fittingMessages);

  return {
    fittingMessages,
    fittingTokens,
    totalTokens,
  };
}
