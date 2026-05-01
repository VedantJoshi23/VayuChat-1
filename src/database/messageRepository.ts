import { v4 as uuidv4 } from 'uuid';
import { executeSql } from './db';
import { Message } from '../types/chat';
import { DB_TABLES } from './schema';

export class MessageRepository {
  async createMessage(
    conversationId: string,
    role: 'user' | 'assistant' | 'system',
    content: string,
    parentMessageId?: string
  ): Promise<Message> {
    const id = uuidv4();
    const timestamp = Date.now();

    const message: Message = {
      id,
      conversationId,
      role,
      content,
      timestamp,
      parentMessageId,
    };

    await executeSql(
      `INSERT INTO ${DB_TABLES.MESSAGES}
       (id, conversation_id, role, content, timestamp, parent_message_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, conversationId, role, content, timestamp, parentMessageId || null]
    );

    return message;
  }

  async getMessagesByConversation(conversationId: string): Promise<Message[]> {
    const result = await executeSql(
      `SELECT * FROM ${DB_TABLES.MESSAGES}
       WHERE conversation_id = ?
       ORDER BY timestamp ASC`,
      [conversationId]
    );

    const messages: Message[] = [];
    for (let i = 0; i < result.rows.length; i++) {
      messages.push(this.rowToMessage(result.rows.item(i)));
    }
    return messages;
  }

  async getMessage(id: string): Promise<Message | null> {
    const result = await executeSql(
      `SELECT * FROM ${DB_TABLES.MESSAGES} WHERE id = ?`,
      [id]
    );

    if (result.rows.length === 0) return null;
    return this.rowToMessage(result.rows.item(0));
  }

  async updateMessage(id: string, updates: Partial<Message>): Promise<void> {
    const setClauses: string[] = [];
    const values: unknown[] = [];

    if (updates.content !== undefined) {
      setClauses.push('content = ?');
      values.push(updates.content);
    }
    if (updates.metadata !== undefined) {
      setClauses.push('metadata = ?');
      values.push(JSON.stringify(updates.metadata));
    }

    if (setClauses.length > 0) {
      values.push(id);
      await executeSql(
        `UPDATE ${DB_TABLES.MESSAGES} SET ${setClauses.join(', ')} WHERE id = ?`,
        values as (string | number)[]
      );
    }
  }

  async deleteMessage(id: string): Promise<void> {
    await executeSql(`DELETE FROM ${DB_TABLES.MESSAGES} WHERE id = ?`, [id]);
  }

  async deleteConversationMessages(conversationId: string): Promise<void> {
    await executeSql(
      `DELETE FROM ${DB_TABLES.MESSAGES} WHERE conversation_id = ?`,
      [conversationId]
    );
  }

  private rowToMessage(row: any): Message {
    return {
      id: row.id,
      conversationId: row.conversation_id,
      role: row.role,
      content: row.content,
      timestamp: row.timestamp,
      parentMessageId: row.parent_message_id,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    };
  }
}
