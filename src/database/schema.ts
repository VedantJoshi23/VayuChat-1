export const DB_TABLES = {
  CONVERSATIONS: 'conversations',
  MESSAGES: 'messages',
  TOOL_CALLS: 'tool_calls',
  MODELS: 'models',
  EXECUTION_LOGS: 'execution_logs',
};

export const CREATE_TABLES_SQL = `
CREATE TABLE IF NOT EXISTS ${DB_TABLES.CONVERSATIONS} (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  model_used TEXT NOT NULL,
  mode TEXT NOT NULL CHECK(mode IN ('tool_calling', 'direct_inference')),
  message_count INTEGER DEFAULT 0,
  system_prompt TEXT,
  archived INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS ${DB_TABLES.MESSAGES} (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  parent_message_id TEXT,
  execution_time INTEGER,
  plots_count INTEGER DEFAULT 0,
  metadata TEXT,
  FOREIGN KEY (conversation_id) REFERENCES ${DB_TABLES.CONVERSATIONS}(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_message_id) REFERENCES ${DB_TABLES.MESSAGES}(id)
);

CREATE TABLE IF NOT EXISTS ${DB_TABLES.TOOL_CALLS} (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL,
  name TEXT NOT NULL,
  arguments TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('pending', 'executing', 'completed', 'failed')),
  result TEXT,
  error TEXT,
  timestamp INTEGER NOT NULL,
  execution_time INTEGER,
  FOREIGN KEY (message_id) REFERENCES ${DB_TABLES.MESSAGES}(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ${DB_TABLES.MODELS} (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  path TEXT NOT NULL,
  format TEXT NOT NULL CHECK(format IN ('gguf', 'pte', 'onnx')),
  size INTEGER,
  context_window INTEGER DEFAULT 2048,
  temperature REAL DEFAULT 0.7,
  max_tokens INTEGER DEFAULT 512,
  tokenizer_path TEXT,
  quantization TEXT,
  metadata TEXT,
  last_used INTEGER,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS ${DB_TABLES.EXECUTION_LOGS} (
  id TEXT PRIMARY KEY,
  message_id TEXT,
  code TEXT,
  stdout TEXT,
  stderr TEXT,
  plots_count INTEGER DEFAULT 0,
  error TEXT,
  execution_time INTEGER,
  timestamp INTEGER NOT NULL,
  FOREIGN KEY (message_id) REFERENCES ${DB_TABLES.MESSAGES}(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation
  ON ${DB_TABLES.MESSAGES}(conversation_id);

CREATE INDEX IF NOT EXISTS idx_messages_timestamp
  ON ${DB_TABLES.MESSAGES}(timestamp);

CREATE INDEX IF NOT EXISTS idx_tool_calls_message
  ON ${DB_TABLES.TOOL_CALLS}(message_id);

CREATE INDEX IF NOT EXISTS idx_tool_calls_status
  ON ${DB_TABLES.TOOL_CALLS}(status);

CREATE INDEX IF NOT EXISTS idx_models_last_used
  ON ${DB_TABLES.MODELS}(last_used);
`;
