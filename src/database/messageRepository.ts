import { Q } from '@nozbe/watermelondb';
import { getDatabase } from './db';
import { Message } from '../types/chat';
import MessageModel from './models/MessageModel';

export class MessageRepository {
  async createMessage(
    conversationId: string,
    role: 'user' | 'assistant' | 'system',
    content: string,
    parentMessageId?: string,
    metadata?: Message['metadata']
  ): Promise<Message> {
    const db = getDatabase();
    const timestamp = Date.now();

    const message = await db.write(async () => {
      return await db.collections.get<MessageModel>('messages').create((msg) => {
        msg.conversationId = conversationId;
        msg.role = role;
        msg.content = content;
        msg.timestamp = timestamp;
        if (parentMessageId) msg.parentMessageId = parentMessageId;
        if (metadata) msg.metadata = JSON.stringify(metadata);
      });
    });

    return this.modelToMessage(message);
  }

  async getMessagesByConversation(conversationId: string): Promise<Message[]> {
    const db = getDatabase();
    const messages = await db.collections
      .get<MessageModel>('messages')
      .query(Q.where('conversation_id', conversationId))
      .fetch();

    return messages
      .sort(
        (a: MessageModel, b: MessageModel) => (a.timestamp || 0) - (b.timestamp || 0)
      )
      .map((m: MessageModel) => this.modelToMessage(m));
  }

  async getMessage(id: string): Promise<Message | null> {
    const db = getDatabase();
    const msg = await db.collections.get<MessageModel>('messages').find(id);
    return msg ? this.modelToMessage(msg) : null;
  }

  async updateMessage(id: string, updates: Partial<Message>): Promise<void> {
    const db = getDatabase();
    
    try {
      const msg = await db.collections.get<MessageModel>('messages').find(id);
      
      // FIX: Add null check to prevent crashes
      if (!msg) {
        throw new Error(`Message with id ${id} not found`);
      }

      await db.write(async () => {
        await msg.update(() => {
          if (updates.content !== undefined) msg.content = updates.content;
          if (updates.metadata !== undefined)
            msg.metadata = JSON.stringify(updates.metadata);
        });
      });
    } catch (error) {
      console.error('Failed to update message:', error);
      throw error;
    }
  }

  async deleteMessage(id: string): Promise<void> {
    const db = getDatabase();
    const msg = await db.collections.get<MessageModel>('messages').find(id);
    if (!msg) return;

    await db.write(async () => {
      await msg.destroyPermanently();
    });
  }

  async deleteConversationMessages(conversationId: string): Promise<void> {
    const db = getDatabase();
    const messages = await db.collections
      .get<MessageModel>('messages')
      .query(Q.where('conversation_id', conversationId))
      .fetch();

    await db.write(async () => {
      for (const msg of messages) {
        await msg.destroyPermanently();
      }
    });
  }

  private modelToMessage(model: MessageModel): Message {
    try {
      return {
        id: model.id,
        conversationId: model.conversationId || '',
        role: (model.role || 'user') as 'user' | 'assistant' | 'system',
        content: model.content || '',
        timestamp: model.timestamp || 0,
        parentMessageId: model.parentMessageId,
        // FIX: Wrap JSON.parse in try-catch to handle corrupted data
        metadata: model.metadata 
          ? (() => {
              try {
                return JSON.parse(model.metadata);
              } catch (e) {
                console.error('Failed to parse message metadata:', e);
                return undefined;
              }
            })()
          : undefined,
      };
    } catch (error) {
      console.error('Error converting model to message:', error);
      throw error;
    }
  }
}
