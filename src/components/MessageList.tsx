import React from 'react';
import {
  FlatList,
  View,
  StyleSheet,
  ActivityIndicator,
  Text,
  Platform,
} from 'react-native';
import { Message } from '../types/chat';
import ChatBubble from './ChatBubble';
import FunctionCallDebugView, { DebugInfo } from './FunctionCallDebugView';
import { Colors } from '../theme/colors';
import { Spacing } from '../theme/spacing';
import { Typography } from '../theme/typography';

interface MessageListProps {
  messages: Message[];
  isLoading?: boolean;
  onEndReached?: () => void;
  /** Map of messageId → DebugInfo, rendered below assistant bubbles in dev mode */
  debugInfoMap?: Record<string, DebugInfo>;
}

export default function MessageList({
  messages,
  isLoading = false,
  onEndReached,
  debugInfoMap = {},
}: MessageListProps) {
  const renderMessage = ({ item }: { item: Message }) => (
    <View>
      <ChatBubble
        role={item.role as 'user' | 'assistant'}
        content={item.content}
        timestamp={item.timestamp}
        metadata={item.metadata}
      />
      {item.role === 'assistant' && debugInfoMap[item.id] && (
        <FunctionCallDebugView debug={debugInfoMap[item.id]} />
      )}
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyTitle}>Start a conversation</Text>
      <Text style={styles.emptySubtitle}>
        Ask about air quality data analysis
      </Text>
    </View>
  );

  const renderFooter = () => {
    if (!isLoading) return null;
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={Colors.primary} size="small" />
      </View>
    );
  };

  return (
    <FlatList
      data={messages}
      renderItem={renderMessage}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.listContent}
      ListEmptyComponent={renderEmpty}
      ListFooterComponent={renderFooter}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.3}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      scrollEnabled
      showsVerticalScrollIndicator={false}
    />
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingVertical: Spacing.md,
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
  },
  emptyTitle: {
    ...Typography.h3,
    color: Colors.primary,
    marginBottom: Spacing.sm,
  },
  emptySubtitle: {
    ...Typography.body,
    color: Colors.darkGray,
    textAlign: 'center',
  },
  loadingContainer: {
    paddingVertical: Spacing.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
