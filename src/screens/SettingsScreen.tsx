import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';
import { Spacing } from '../theme/spacing';

export default function SettingsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Settings</Text>
      <Text style={styles.subtitle}>
        Configure models, tokenizers, and execution modes
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  title: {
    ...Typography.h2,
    color: Colors.primary,
    marginBottom: Spacing.md,
  },
  subtitle: {
    ...Typography.body,
    color: Colors.darkGray,
    textAlign: 'center',
  },
});
