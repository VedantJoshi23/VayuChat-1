import React from 'react';
import { View, Text, StyleSheet, useWindowDimensions, TouchableOpacity, Share } from 'react-native';
import { Colors, Shadows } from '../theme/colors';
import { Typography } from '../theme/typography';
import { Spacing, BorderRadius } from '../theme/spacing';
import { formatExecutionTime, formatRelativeTime } from '../utils/formatting';
import { Bot, User, Share2 } from './icons';
import { Message } from '../types/chat';

interface ChatBubbleProps {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  showTime?: boolean;
  metadata?: Message['metadata'];
}

export default function ChatBubble({
  role,
  content,
  timestamp,
  showTime = false,
  metadata,
}: ChatBubbleProps) {
  const { width } = useWindowDimensions();
  const isUser = role === 'user';
  const maxWidth = width * 0.8;
  const Icon = isUser ? User : Bot;
  const inference = metadata?.inference;

  const handleShare = async () => {
    try {
      await Share.share({
        message: content,
      });
    } catch (error) {
      console.error('Error sharing message:', error);
    }
  };

  return (
    <View style={[styles.container, isUser && styles.userContainer]}>
      <View style={[styles.row, isUser && styles.userRow]}>
        {!isUser && (
          <View style={[styles.avatar, styles.assistantAvatar]}>
            <Icon size={16} color={Colors.primaryDark} strokeWidth={2} />
          </View>
        )}
        <View style={styles.contentWrap}>
          <View style={styles.headerRow}>
            <Text style={[styles.roleLabel, isUser && styles.userRoleLabel]}>
              {isUser ? 'You' : 'Assistant'}
            </Text>
            <TouchableOpacity 
              onPress={handleShare} 
              style={styles.actionButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Share2 size={12} color={Colors.darkGray} />
            </TouchableOpacity>
          </View>
          <View
            style={[
              styles.bubble,
              isUser ? styles.userBubble : styles.assistantBubble,
              { maxWidth },
              Shadows.small,
            ]}
          >
            <Text
              style={[
                Typography.body,
                isUser ? styles.userText : styles.assistantText,
              ]}
            >
              {content}
            </Text>
            {!isUser && inference && (
              <View style={styles.metricsRow}>
                <Text style={styles.metricsText}>
                  {`${inference.outputTokens} tok`}
                </Text>
                <Text style={styles.metricsText}>
                  {`${inference.tokensPerSecond.toFixed(1)} tok/s`}
                </Text>
                <Text style={styles.metricsText}>
                  {formatExecutionTime(inference.generationTimeMs)}
                </Text>
                <Text style={styles.metricsText}>
                  {`TTFT ${formatExecutionTime(inference.timeToFirstTokenMs)}`}
                </Text>
              </View>
            )}
          </View>
        </View>
        {isUser && (
          <View style={[styles.avatar, styles.userAvatar]}>
            <Icon size={16} color={Colors.white} strokeWidth={2} />
          </View>
        )}
      </View>
      {showTime && (
        <Text style={styles.timestamp}>{formatRelativeTime(timestamp)}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: Spacing.sm,
    marginHorizontal: Spacing.lg,
    alignItems: 'flex-start',
  },
  userContainer: {
    alignItems: 'flex-end',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.sm,
  },
  userRow: {
    flexDirection: 'row-reverse',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  assistantAvatar: {
    backgroundColor: `${Colors.primary}18`,
  },
  userAvatar: {
    backgroundColor: Colors.primaryDark,
  },
  contentWrap: {
    alignItems: 'flex-start',
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 2,
  },
  actionButton: {
    padding: 2,
    opacity: 0.7,
  },
  bubble: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.xl,
  },
  userBubble: {
    backgroundColor: Colors.primary,
    borderWidth: 1,
    borderColor: Colors.gradientFreshAirEnd,
    borderBottomRightRadius: BorderRadius.sm,
  },
  assistantBubble: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.lightGray,
    borderBottomLeftRadius: BorderRadius.sm,
  },
  roleLabel: {
    ...Typography.caption,
    color: Colors.darkGray,
    marginBottom: 4,
    paddingHorizontal: 2,
  },
  userRoleLabel: {
    alignSelf: 'flex-end',
  },
  userText: {
    color: Colors.white,
  },
  assistantText: {
    color: Colors.charcoal,
  },
  metricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.lightGray,
  },
  metricsText: {
    ...Typography.caption,
    color: Colors.darkGray,
    fontWeight: '600',
  },
  timestamp: {
    ...Typography.caption,
    marginTop: Spacing.xs,
    paddingHorizontal: Spacing.md,
  },
});
