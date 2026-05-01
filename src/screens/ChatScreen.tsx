import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';
import { Spacing } from '../theme/spacing';

export default function ChatScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Chat Interface</Text>
      <Text style={styles.subtitle}>
        Coming soon - Type your air quality queries here
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
