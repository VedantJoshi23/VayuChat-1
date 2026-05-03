import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';
import { Spacing, BorderRadius } from '../theme/spacing';
import { Cpu, AlertCircle, Loader2, RefreshCw } from './icons';

export type ChipState = 'ready' | 'loading' | 'error' | 'idle';

interface ModelStatusChipProps {
  modelName: string | null;
  state: ChipState;
  onPress?: () => void;
  onRefresh?: () => void;
}

export default function ModelStatusChip({
  modelName,
  state,
  onPress,
  onRefresh,
}: ModelStatusChipProps) {
  let Icon = Cpu;
  let color = Colors.success;
  let label = modelName ?? 'Select model';
  if (state === 'loading') {
    Icon = Loader2;
    color = Colors.warning;
    label = 'Loading…';
  } else if (state === 'error') {
    Icon = AlertCircle;
    color = Colors.error;
    label = 'Model error';
  } else if (state === 'idle') {
    Icon = Cpu;
    color = Colors.gray;
    label = 'No model';
  }

  const Wrapper: any = onPress ? TouchableOpacity : View;
  return (
    <View style={styles.chip}>
      <Wrapper
        style={styles.mainAction}
        onPress={onPress}
        activeOpacity={0.8}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      >
        <View style={[styles.dot, { backgroundColor: color }]} />
        <Icon size={14} color={Colors.white} strokeWidth={2} />
        <Text style={styles.label} numberOfLines={1}>
          {label}
        </Text>
      </Wrapper>
      {onRefresh && state !== 'loading' && state !== 'idle' && (
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={onRefresh}
          activeOpacity={0.8}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <RefreshCw size={14} color={Colors.white} strokeWidth={2} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.round,
    backgroundColor: Colors.charcoal,
    maxWidth: 120,
  },
  mainAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  label: {
    ...Typography.caption,
    color: Colors.white,
    fontWeight: '600',
    fontSize: 12,
  },
  refreshButton: {
    marginLeft: Spacing.sm,
    paddingLeft: Spacing.sm,
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255,255,255,0.16)',
  },
});
