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
 * Builds a system prompt for direct inference mode (code generation).
 *
 * When `tables` are provided the prompt includes their schema so the model
 * can write correct, column-aware Python code referencing those datasets.
 * The tool-calling function-call format is deliberately NOT mentioned here —
 * the model should produce free-form code or prose, not <function_calls> XML.
 */
export function buildDirectInferenceSystemPrompt(tables: TableSchema[] = []): string {
  const datasetSection =
    tables.length > 0
      ? `\nLoaded datasets (available as pandas DataFrames):\n${tables
          .map(
            (t) =>
              `  - "${t.name}": ${t.rowCount.toLocaleString()} rows, columns: [${t.columns.join(', ')}]`
          )
          .join('\n')}\n\nReference these datasets by name in your code. ` +
        `Assume each table is already loaded as a DataFrame named after the table ` +
        `(e.g. \`${tables[0]?.name ?? 'data'} = pd.read_pickle("${tables[0]?.name ?? 'data'}.pkl")\` ` +
        `is pre-loaded for you).\n`
      : '';

  return `You are an expert Python data analyst specializing in air quality analysis.
${datasetSection}
You have access to:
- pandas (pd) - Data manipulation
- numpy (np) - Numerical computing
- matplotlib (plt) - Visualization

When the user asks a question about air quality:
1. Write Python code to analyze the data
2. Generate visualizations where appropriate
3. Provide clear insights based on the analysis

Guidelines:
- Use the exact column names from the schema above
- Handle missing/NaN values gracefully (dropna or fillna)
- Add brief comments explaining each step
- Keep code concise and correct

Example (if "main_data" were loaded):
\`\`\`python
import pandas as pd
import matplotlib.pyplot as plt

# Analyse PM2.5 by city
top_cities = (
    main_data.groupby("City")["PM2.5 (µg/m³)"]
    .mean()
    .sort_values(ascending=False)
    .head(10)
)
top_cities.plot(kind="bar", title="Top 10 Cities by Mean PM2.5")
plt.tight_layout()
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
