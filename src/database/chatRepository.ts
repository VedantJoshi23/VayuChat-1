import { v4 as uuidv4 } from 'uuid';
import { executeSql } from './db';
import { Conversation } from '../types/chat';
import { DB_TABLES } from './schema';

export class ChatRepository {
  async createConversation(
    title: string,
    modelUsed: string,
    mode: 'tool_calling' | 'direct_inference',
    systemPrompt?: string
  ): Promise<Conversation> {
    const id = uuidv4();
    const now = Date.now();

    const conversation: Conversation = {
      id,
      title,
      createdAt: now,
      updatedAt: now,
      modelUsed,
      mode,
      messageCount: 0,
      systemPrompt,
    };

    await executeSql(
      `INSERT INTO ${DB_TABLES.CONVERSATIONS}
       (id, title, created_at, updated_at, model_used, mode, system_prompt)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, title, now, now, modelUsed, mode, systemPrompt || null]
    );

    return conversation;
  }

  async getConversation(id: string): Promise<Conversation | null> {
    const result = await executeSql(
      `SELECT * FROM ${DB_TABLES.CONVERSATIONS} WHERE id = ?`,
      [id]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows.item(0);
    return this.rowToConversation(row);
  }

  async getAllConversations(): Promise<Conversation[]> {
    const result = await executeSql(
      `SELECT * FROM ${DB_TABLES.CONVERSATIONS}
       WHERE archived = 0
       ORDER BY updated_at DESC`
    );

    const conversations: Conversation[] = [];
    for (let i = 0; i < result.rows.length; i++) {
      conversations.push(this.rowToConversation(result.rows.item(i)));
    }
    return conversations;
  }

  async updateConversation(
    id: string,
    updates: Partial<Conversation>
  ): Promise<void> {
    const setClauses: string[] = [];
    const values: unknown[] = [];

    if (updates.title !== undefined) {
      setClauses.push('title = ?');
      values.push(updates.title);
    }
    if (updates.messageCount !== undefined) {
      setClauses.push('message_count = ?');
      values.push(updates.messageCount);
    }

    setClauses.push('updated_at = ?');
    values.push(Date.now());
    values.push(id);

    if (setClauses.length > 0) {
      await executeSql(
        `UPDATE ${DB_TABLES.CONVERSATIONS} SET ${setClauses.join(', ')} WHERE id = ?`,
        values as (string | number)[]
      );
    }
  }

  async deleteConversation(id: string): Promise<void> {
    await executeSql(
      `DELETE FROM ${DB_TABLES.CONVERSATIONS} WHERE id = ?`,
      [id]
    );
  }

  async archiveConversation(id: string): Promise<void> {
    await executeSql(
      `UPDATE ${DB_TABLES.CONVERSATIONS} SET archived = 1, updated_at = ? WHERE id = ?`,
      [Date.now(), id]
    );
  }

  private rowToConversation(row: any): Conversation {
    return {
      id: row.id,
      title: row.title,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      modelUsed: row.model_used,
      mode: row.mode,
      messageCount: row.message_count || 0,
      systemPrompt: row.system_prompt,
    };
  }
}
