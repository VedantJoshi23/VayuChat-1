import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Colors, Shadows } from '../theme/colors';
import { Typography } from '../theme/typography';
import { Spacing, BorderRadius } from '../theme/spacing';

interface CodeBlockProps {
  code: string;
  language?: string;
  onCopy?: () => void;
}

export default function CodeBlock({
  code,
  language = 'python',
  onCopy,
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    onCopy?.();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <View style={[styles.container, Shadows.small]}>
      <View style={styles.header}>
        <Text style={styles.language}>{language}</Text>
        <TouchableOpacity onPress={handleCopy} style={styles.copyButton}>
          <Text style={styles.copyText}>
            {copied ? '✓ Copied' : 'Copy'}
          </Text>
        </TouchableOpacity>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.scrollView}
      >
        <View style={styles.codeContainer}>
          <Text style={[Typography.mono, styles.code]}>{code}</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.charcoal,
    borderRadius: BorderRadius.lg,
    marginVertical: Spacing.md,
    marginHorizontal: Spacing.lg,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.darkGray,
  },
  language: {
    ...Typography.label,
    color: Colors.primary,
    textTransform: 'lowercase',
  },
  copyButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
  },
  copyText: {
    ...Typography.label,
    color: Colors.white,
    fontSize: 12,
  },
  scrollView: {
    maxHeight: 300,
  },
  codeContainer: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  code: {
    color: Colors.offWhite,
    lineHeight: 20,
  },
});
