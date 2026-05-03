import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { Colors, Shadows } from '../theme/colors';
import { Typography } from '../theme/typography';
import { Spacing, BorderRadius } from '../theme/spacing';

type LucideIcon = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  body?: string;
  ctaLabel?: string;
  onCtaPress?: () => void;
  style?: ViewStyle;
  tone?: 'info' | 'warning' | 'neutral';
}

export default function EmptyState({
  icon: Icon,
  title,
  body,
  ctaLabel,
  onCtaPress,
  style,
  tone = 'info',
}: EmptyStateProps) {
  const accent =
    tone === 'warning' ? Colors.warning : tone === 'neutral' ? Colors.darkGray : Colors.primary;

  return (
    <View style={[styles.container, style]}>
      {Icon && (
        <View style={[styles.iconWrap, { backgroundColor: `${accent}14` }]}>
          <Icon size={44} color={accent} strokeWidth={1.6} />
        </View>
      )}
      <Text style={styles.title}>{title}</Text>
      {body && <Text style={styles.body}>{body}</Text>}
      {ctaLabel && onCtaPress && (
        <TouchableOpacity
          style={[styles.cta, { backgroundColor: accent }, Shadows.medium]}
          onPress={onCtaPress}
          activeOpacity={0.85}
        >
          <Text style={styles.ctaText}>{ctaLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.xl,
  },
  iconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  title: {
    ...Typography.h3,
    color: Colors.charcoal,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  body: {
    ...Typography.body,
    color: Colors.darkGray,
    textAlign: 'center',
    marginBottom: Spacing.xl,
    lineHeight: 22,
    maxWidth: 320,
  },
  cta: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    minWidth: 200,
    alignItems: 'center',
  },
  ctaText: {
    ...Typography.button,
    color: Colors.white,
    fontWeight: '600',
  },
});
