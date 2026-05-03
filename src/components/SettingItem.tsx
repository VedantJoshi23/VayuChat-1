import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  TouchableOpacity,
} from 'react-native';
import { Colors, Shadows } from '../theme/colors';
import { Typography } from '../theme/typography';
import { Spacing, BorderRadius } from '../theme/spacing';
import { ChevronRight } from './icons';

interface SettingItemProps {
  label: string;
  description?: string;
  value?: string | boolean;
  onValueChange?: (value: any) => void;
  onPress?: () => void;
  type?: 'toggle' | 'text' | 'action';
  disabled?: boolean;
}

export default function SettingItem({
  label,
  description,
  value,
  onValueChange,
  onPress,
  type = 'text',
  disabled = false,
}: SettingItemProps) {
  const Wrapper: any = type === 'action' && onPress ? TouchableOpacity : View;

  return (
    <Wrapper
      style={[styles.container, Shadows.small, disabled && styles.disabled]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      <View style={styles.labelContainer}>
        <Text style={styles.label}>{label}</Text>
        {description && (
          <Text style={styles.description} numberOfLines={2}>
            {description}
          </Text>
        )}
      </View>

      {type === 'toggle' && (
        <Switch
          value={value as boolean}
          onValueChange={onValueChange}
          disabled={disabled}
          trackColor={{ false: Colors.lightGray, true: Colors.primaryLight }}
          thumbColor={Colors.white}
        />
      )}

      {type === 'text' && value !== undefined && value !== '' && (
        <Text style={styles.value} numberOfLines={1}>
          {String(value)}
        </Text>
      )}

      {type === 'action' && (
        <ChevronRight size={20} color={Colors.gray} strokeWidth={2} />
      )}
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.white,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    marginHorizontal: Spacing.lg,
    marginVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
  },
  disabled: { opacity: 0.5 },
  labelContainer: { flex: 1, paddingRight: Spacing.md },
  label: {
    ...Typography.body,
    color: Colors.charcoal,
    fontWeight: '600',
    marginBottom: 2,
  },
  description: {
    ...Typography.caption,
    color: Colors.darkGray,
  },
  value: {
    ...Typography.bodySmall,
    color: Colors.primary,
    fontWeight: '600',
    maxWidth: 140,
  },
});
