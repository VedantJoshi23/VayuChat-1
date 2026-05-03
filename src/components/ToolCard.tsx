import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors, Shadows } from '../theme/colors';
import { Typography } from '../theme/typography';
import { Spacing, BorderRadius } from '../theme/spacing';
import { ToolCall } from '../types/common';
import { AlertCircle, CheckCircle2, ChevronDown, ChevronRight, Wrench } from './icons';

interface ToolCardProps {
  tool: ToolCall;
}

export default function ToolCard({ tool }: ToolCardProps) {
  const [expanded, setExpanded] = useState(false);

  const toggleExpand = () => {
    setExpanded(!expanded);
  };

  const getStatusColor = () => {
    switch (tool.status) {
      case 'completed':
        return Colors.success;
      case 'failed':
        return Colors.error;
      case 'executing':
        return Colors.warning;
      default:
        return Colors.gray;
    }
  };

  const statusColor = getStatusColor();
  const statusLabel =
    tool.status === 'completed'
      ? 'Success'
      : tool.status === 'failed'
      ? 'Failed'
      : tool.status === 'executing'
      ? 'Running'
      : 'Queued';
  const StatusIcon = tool.status === 'failed' ? AlertCircle : CheckCircle2;

  return (
    <View style={[styles.container, Shadows.medium]}>
      <TouchableOpacity
        onPress={toggleExpand}
        style={styles.header}
        activeOpacity={0.7}
      >
        <View style={styles.titleRow}>
          <View style={styles.toolIconWrap}>
            <Wrench size={16} color={Colors.primaryDark} strokeWidth={2} />
          </View>
          <View style={styles.titleTextWrap}>
            <Text style={styles.toolName}>{tool.name}</Text>
            <View style={[styles.statusPill, { backgroundColor: `${statusColor}18` }]}>
              <StatusIcon size={12} color={statusColor} strokeWidth={2} />
              <Text style={[styles.statusLabel, { color: statusColor }]}>{statusLabel}</Text>
            </View>
          </View>
        </View>
        {expanded ? (
          <ChevronDown size={18} color={Colors.darkGray} strokeWidth={2} />
        ) : (
          <ChevronRight size={18} color={Colors.darkGray} strokeWidth={2} />
        )}
      </TouchableOpacity>

      {expanded && (
        <View style={styles.content}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Arguments</Text>
            <Text style={styles.json}>
              {JSON.stringify(tool.arguments, null, 2)}
            </Text>
          </View>
          {tool.result !== undefined && tool.result !== null ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Result</Text>
              <Text style={styles.json}>
                {typeof tool.result === 'string'
                  ? tool.result
                  : JSON.stringify(tool.result, null, 2)}
              </Text>
            </View>
          ) : null}
          {tool.error !== undefined && tool.error !== null ? (
            <View style={[styles.section, styles.errorSection]}>
              <Text style={styles.errorTitle}>Error</Text>
              <Text style={styles.errorText}>{tool.error}</Text>
            </View>
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: Colors.lightGray,
    borderRadius: BorderRadius.lg,
    marginVertical: Spacing.sm,
    marginHorizontal: Spacing.lg,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.offWhite,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: Spacing.md,
  },
  toolIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${Colors.primary}16`,
  },
  titleTextWrap: {
    flex: 1,
  },
  toolName: {
    ...Typography.body,
    color: Colors.charcoal,
    fontWeight: '600',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    marginTop: 6,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.round,
  },
  statusLabel: {
    ...Typography.caption,
    fontWeight: '600',
  },
  content: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.lightGray,
  },
  section: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    ...Typography.label,
    color: Colors.primary,
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
  },
  json: {
    ...Typography.mono,
    fontSize: 11,
    color: Colors.charcoal,
    backgroundColor: Colors.offWhite,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  errorSection: {
    backgroundColor: '#fee',
  },
  errorTitle: {
    ...Typography.label,
    color: Colors.error,
    marginBottom: Spacing.sm,
  },
  errorText: {
    ...Typography.bodySmall,
    color: Colors.error,
    backgroundColor: Colors.offWhite,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
});
