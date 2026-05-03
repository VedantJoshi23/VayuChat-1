import React, { useState, useCallback } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Text,
  LayoutAnimation,
  Platform,
} from 'react-native';
import { Colors, Shadows } from '../theme/colors';
import { Typography } from '../theme/typography';
import { Spacing, BorderRadius } from '../theme/spacing';
import { Send, ChevronDown, ChevronUp } from './icons';

// Note: UIManager.setLayoutAnimationEnabledExperimental is a no-op in the
// New Architecture (Fabric/Bridgeless) and produces a warning — do not call it.
// LayoutAnimation itself works without it in New Architecture.

const SAMPLE_PROMPTS = [
  'What is the current AQI in my city?',
  'Show me PM2.5 trends for the last 7 days.',
  'Which pollutant is highest right now?',
  'Compare air quality across different locations.',
  'What health precautions should I take today?',
  'Summarize the dataset statistics.',
  'Plot monthly average AQI values.',
  'Which days had hazardous air quality?',
];

interface MessageInputProps {
  onSend: (message: string) => void;
  isLoading?: boolean;
  placeholder?: string;
  bottomInset?: number;
}

export default function MessageInput({
  onSend,
  isLoading = false,
  placeholder = 'Ask about air quality…',
  bottomInset = 0,
}: MessageInputProps) {
  const [text, setText] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [promptsExpanded, setPromptsExpanded] = useState(false);

  const handleSend = useCallback(() => {
    if (text.trim() && !isLoading) {
      onSend(text.trim());
      setText('');
      setPromptsExpanded(false);
    }
  }, [text, isLoading, onSend]);

  const handlePromptTap = useCallback(
    (prompt: string) => {
      if (isLoading) return;
      // Directly send — matches "on tap, directly send the query" requirement
      onSend(prompt);
      setPromptsExpanded(false);
    },
    [isLoading, onSend]
  );

  const togglePrompts = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setPromptsExpanded((prev) => !prev);
  }, []);

  return (
    <View style={[styles.wrapper, { paddingBottom: Math.max(Spacing.md, bottomInset) }]}>
      {/* Sample prompts collapsible panel */}
      {promptsExpanded && (
        <View style={styles.promptsPanel}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.promptsScroll}
            keyboardShouldPersistTaps="handled"
          >
            {SAMPLE_PROMPTS.map((prompt) => (
              <TouchableOpacity
                key={prompt}
                style={[styles.promptChip, isLoading && styles.promptChipDisabled]}
                onPress={() => handlePromptTap(prompt)}
                activeOpacity={0.7}
                disabled={isLoading}
              >
                <Text style={styles.promptChipText} numberOfLines={2}>
                  {prompt}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Input row */}
      <View style={[styles.inputRow, Shadows.medium, isFocused && styles.inputRowFocused]}>
        {/* Expand/collapse prompts toggle */}
        <TouchableOpacity
          style={styles.toggleBtn}
          onPress={togglePrompts}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel={promptsExpanded ? 'Hide sample questions' : 'Show sample questions'}
        >
          {promptsExpanded ? (
            <ChevronDown size={18} color={Colors.primary} strokeWidth={2} />
          ) : (
            <ChevronUp size={18} color={Colors.darkGray} strokeWidth={2} />
          )}
        </TouchableOpacity>

        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor={Colors.gray}
          value={text}
          onChangeText={setText}
          multiline
          maxLength={2000}
          editable={!isLoading}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onSubmitEditing={handleSend}
        />

        <TouchableOpacity
          style={[
            styles.sendButton,
            (isLoading || !text.trim()) && styles.sendButtonDisabled,
          ]}
          onPress={handleSend}
          disabled={isLoading || !text.trim()}
          activeOpacity={0.7}
          accessibilityLabel="Send message"
        >
          {isLoading ? (
            <ActivityIndicator color={Colors.white} size="small" />
          ) : (
            <Send size={18} color={Colors.white} strokeWidth={2.2} />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.lightGray,
  },

  // Collapsible prompts panel
  promptsPanel: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightGray,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.offWhite,
  },
  promptsScroll: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  promptChip: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.primary + '55',
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    maxWidth: 220,
    ...Shadows.small,
  },
  promptChipDisabled: {
    opacity: 0.45,
  },
  promptChipText: {
    ...Typography.bodySmall,
    color: Colors.charcoal,
    lineHeight: 18,
  },

  // Input row
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
    backgroundColor: Colors.white,
  },
  inputRowFocused: {
    borderTopColor: Colors.primary,
  },
  toggleBtn: {
    width: 32,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    ...Typography.body,
    backgroundColor: Colors.offWhite,
    borderRadius: BorderRadius.round,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    maxHeight: 100,
    color: Colors.charcoal,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.round,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: Colors.gray,
    opacity: 0.5,
  },
});
