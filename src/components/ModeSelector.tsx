import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { Colors, Shadows } from '../theme/colors';
import { Typography } from '../theme/typography';
import { Spacing, BorderRadius } from '../theme/spacing';
import { Wrench, Code2 } from './icons';
import { useSettingsStore } from '../store/settingsStore';

type Variant = 'full' | 'compact';

interface ModeSelectorProps {
  variant?: Variant;
  style?: ViewStyle;
}

const OPTIONS = [
  {
    value: 'tool_calling' as const,
    label: 'Tool Calling',
    short: 'Tools',
    description: 'Structured function calls',
    Icon: Wrench,
  },
  {
    value: 'direct_inference' as const,
    label: 'Direct Inference',
    short: 'Direct',
    description: 'Raw code generation',
    Icon: Code2,
  },
];

export default function ModeSelector({ variant = 'full', style }: ModeSelectorProps) {
  const { mode, setMode } = useSettingsStore();
  const isCompact = variant === 'compact';

  return (
    <View style={[isCompact ? styles.compactContainer : styles.fullContainer, style]}>
      {OPTIONS.map((opt) => {
        const active = mode === opt.value;
        const Icon = opt.Icon;
        return (
          <TouchableOpacity
            key={opt.value}
            style={[
              isCompact ? styles.compactPill : styles.fullPill,
              active && (isCompact ? styles.compactPillActive : styles.fullPillActive),
              active && Shadows.small,
            ]}
            onPress={() => setMode(opt.value)}
            activeOpacity={0.8}
          >
            <Icon
              size={isCompact ? 14 : 18}
              color={active ? Colors.black : Colors.darkGray}
              strokeWidth={2}
            />
            <View style={isCompact ? styles.compactTextWrap : styles.fullTextWrap}>
              <Text
                style={[
                  isCompact ? styles.compactLabel : styles.fullLabel,
                  active && styles.activeText,
                ]}
              >
                {isCompact ? opt.short : opt.label}
              </Text>
              {!isCompact && (
                <Text
                  style={[
                    styles.fullDescription,
                    active && styles.activeDescription,
                  ]}
                >
                  {opt.description}
                </Text>
              )}
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  // FULL variant — segmented control card for SettingsScreen
  fullContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.lightGray,
    borderRadius: BorderRadius.lg,
    padding: 4,
    gap: 4,
    marginHorizontal: Spacing.lg,
  },
  fullPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  fullPillActive: {
    backgroundColor: Colors.primary,
  },
  fullTextWrap: { flex: 1 },
  fullLabel: {
    ...Typography.body,
    color: Colors.charcoal,
    fontWeight: '600',
  },
  fullDescription: {
    ...Typography.caption,
    color: Colors.darkGray,
    marginTop: 1,
  },
  activeText: { color: Colors.black },
  activeDescription: { color: 'rgba(255,255,255,0.85)' },

  // COMPACT variant — chat header chip pair
  compactContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.charcoal,
    borderRadius: BorderRadius.round,
    padding: 3,
    gap: 2,
    alignSelf: 'flex-start',
  },
  compactPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.round,
  },
  compactPillActive: {
    backgroundColor: Colors.white,
  },
  compactTextWrap: {},
  compactLabel: {
    ...Typography.caption,
    color: Colors.success,
    fontWeight: '600',
    fontSize: 12,
  },
});
