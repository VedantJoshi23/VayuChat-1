import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Colors, Shadows } from '../theme/colors';
import { Typography } from '../theme/typography';
import { Spacing, BorderRadius } from '../theme/spacing';
import { Conversation } from '../types/chat';
import { ChatRepository } from '../database/chatRepository';
import { useChatStore } from '../store/chatStore';
import { MessageRepository } from '../database/messageRepository';
import { formatRelativeTime } from '../utils/formatting';

const chatRepo = new ChatRepository();
const msgRepo = new MessageRepository();

export default function ChatHistoryScreen() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const { setCurrentConversation, setMessages } = useChatStore();
  const navigation = useNavigation<any>();

  useEffect(() => {
    loadConversations();
  }, []);

  const loadConversations = async () => {
    try {
      const convs = await chatRepo.getAllConversations();
      setConversations(convs);
    } catch (error) {
      console.error('[ChatHistoryScreen] Failed to load conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectConversation = async (conv: Conversation) => {
    try {
      const msgs = await msgRepo.getMessagesByConversation(conv.id);
      setCurrentConversation(conv as any);
      setMessages(msgs);
      // Navigate to the Chat tab so the restored session is immediately visible
      navigation.navigate('Chat');
    } catch (error) {
      console.error('[ChatHistoryScreen] Failed to load conversation messages:', error);
    }
  };

  const renderConversation = ({ item }: { item: Conversation }) => (
    <TouchableOpacity
      style={[styles.item, Shadows.small]}
      onPress={() => handleSelectConversation(item)}
      activeOpacity={0.7}
    >
      <View style={styles.itemContent}>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.meta}>
          {item.messageCount} messages • {formatRelativeTime(item.updatedAt)}
        </Text>
        <View style={styles.tags}>
          <View style={styles.tag}>
            <Text style={styles.tagText}>{item.mode}</Text>
          </View>
          <View style={styles.tag}>
            <Text style={styles.tagText}>{item.modelUsed}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  if (conversations.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyTitle}>No conversations yet</Text>
        <Text style={styles.emptySubtitle}>
          Start a new chat to begin analyzing air quality data
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={conversations}
      renderItem={renderConversation}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.listContent}
      scrollEnabled
      showsVerticalScrollIndicator={false}
    />
  );
}

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    backgroundColor: Colors.white,
  },
  listContent: {
    padding: Spacing.lg,
    backgroundColor: Colors.white,
  },
  item: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  itemContent: {
    gap: Spacing.sm,
  },
  title: {
    ...Typography.h4,
    color: Colors.charcoal,
  },
  meta: {
    ...Typography.caption,
    color: Colors.darkGray,
  },
  tags: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  tag: {
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.md,
  },
  tagText: {
    ...Typography.caption,
    color: Colors.white,
    fontWeight: '600',
  },
  emptyTitle: {
    ...Typography.h3,
    color: Colors.primary,
    marginBottom: Spacing.md,
    textAlign: 'center',
  },
  emptySubtitle: {
    ...Typography.body,
    color: Colors.darkGray,
    textAlign: 'center',
  },
});
