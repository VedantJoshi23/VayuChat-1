import { Database, appSchema } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import {
  conversationsSchema,
  messagesSchema,
  toolCallsSchema,
  modelsSchema,
  executionLogsSchema,
} from './schema';
import ConversationModel from './models/ConversationModel';
import MessageModel from './models/MessageModel';
import ToolCallModel from './models/ToolCallModel';
import ModelModel from './models/ModelModel';
import ExecutionLogModel from './models/ExecutionLogModel';

let db: Database | null = null;
let initPromise: Promise<Database> | null = null;

const schema = appSchema({
  version: 1,
  tables: [
    conversationsSchema,
    messagesSchema,
    toolCallsSchema,
    modelsSchema,
    executionLogsSchema,
  ],
});

export async function initDatabase(): Promise<Database> {
  if (db) {
    return db;
  }

  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    try {
      const adapter = new SQLiteAdapter({
        dbName: 'air_quality_app',
        schema,
        onSetUpError: (error) => {
          console.error('WatermelonDB setup error:', error);
        },
      });

      db = new Database({
        adapter,
        modelClasses: [
          ConversationModel,
          MessageModel,
          ToolCallModel,
          ModelModel,
          ExecutionLogModel,
        ],
      });

      return db;
    } catch (error) {
      initPromise = null;
      throw new Error(
        `Failed to initialize database: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  })();

  return initPromise;
}

export function getDatabase(): Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

export async function closeDatabase(): Promise<void> {
  if (db) {
    await db.action(async () => {
      // Cleanup if needed
    });
    db = null;
  }
  initPromise = null;
}
