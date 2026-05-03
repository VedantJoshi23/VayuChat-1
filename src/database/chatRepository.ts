import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from './db';
import { Conversation } from '../types/chat';
import ConversationModel from './models/ConversationModel';

export class ChatRepository {
  async createConversation(
    title: string,
    modelUsed: string,
    mode: 'tool_calling' | 'direct_inference',
    systemPrompt?: string
  ): Promise<Conversation> {
    const db = getDatabase();
    const now = Date.now();

    const conversation = await db.write(async () => {
      return await db.collections.get<ConversationModel>('conversations').create(
        (conv) => {
          conv.title = title;
          conv.createdAt = now;
          conv.updatedAt = now;
          conv.modelUsed = modelUsed;
          conv.mode = mode;
          conv.messageCount = 0;
          if (systemPrompt) conv.systemPrompt = systemPrompt;
          conv.archived = false;
        }
      );
    });

    return this.modelToConversation(conversation);
  }

  async getConversation(id: string): Promise<Conversation | null> {
    const db = getDatabase();
    const conv = await db.collections
      .get<ConversationModel>('conversations')
      .find(id);
    return conv ? this.modelToConversation(conv) : null;
  }

  async getAllConversations(): Promise<Conversation[]> {
    const db = getDatabase();
    const convs = await db.collections
      .get<ConversationModel>('conversations')
      .query()
      .fetch();

    return convs
      .filter((c) => !c.archived)
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
      .map((c) => this.modelToConversation(c));
  }

  async updateConversation(
    id: string,
    updates: Partial<Conversation>
  ): Promise<void> {
    const db = getDatabase();
    const conv = await db.collections
      .get<ConversationModel>('conversations')
      .find(id);

    await db.write(async () => {
      await conv.update(() => {
        if (updates.title !== undefined) conv.title = updates.title;
        if (updates.messageCount !== undefined)
          conv.messageCount = updates.messageCount;
        conv.updatedAt = Date.now();
      });
    });
  }

  async deleteConversation(id: string): Promise<void> {
    const db = getDatabase();
    const conv = await db.collections
      .get<ConversationModel>('conversations')
      .find(id);

    await db.write(async () => {
      await conv.destroyPermanently();
    });
  }

  async incrementMessageCount(id: string): Promise<void> {
    const db = getDatabase();
    try {
      const conv = await db.collections
        .get<ConversationModel>('conversations')
        .find(id);
      await db.write(async () => {
        await conv.update(() => {
          conv.messageCount = (conv.messageCount ?? 0) + 1;
          conv.updatedAt = Date.now();
        });
      });
    } catch (e) {
      console.warn('[ChatRepository] incrementMessageCount failed:', e);
    }
  }

  async archiveConversation(id: string): Promise<void> {
    const db = getDatabase();
    const conv = await db.collections
      .get<ConversationModel>('conversations')
      .find(id);

    await db.write(async () => {
      await conv.update(() => {
        conv.archived = true;
        conv.updatedAt = Date.now();
      });
    });
  }

  private modelToConversation(model: ConversationModel): Conversation {
    return {
      id: model.id,
      title: model.title || '',
      createdAt: model.createdAt || 0,
      updatedAt: model.updatedAt || 0,
      modelUsed: model.modelUsed || 'default',
      mode: (model.mode || 'tool_calling') as 'tool_calling' | 'direct_inference',
      messageCount: model.messageCount || 0,
      systemPrompt: model.systemPrompt,
    };
  }
}
