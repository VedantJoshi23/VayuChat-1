import React, { useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Colors, Shadows } from '../theme/colors';
import { Typography } from '../theme/typography';
import { Spacing, BorderRadius } from '../theme/spacing';
import { Send } from './icons';

interface MessageInputProps {
  onSend: (message: string) => void;
  isLoading?: boolean;
  placeholder?: string;
  bottomInset?: number;
}

export default function MessageInput({
  onSend,
  isLoading = false,
  placeholder = 'Ask about air quality...',
  bottomInset = 0,
}: MessageInputProps) {
  const [text, setText] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  const handleSend = () => {
    if (text.trim()) {
      onSend(text);
      setText('');
    }
  };

  return (
    <View
      style={[
        styles.container,
        Shadows.medium,
        isFocused && styles.containerFocused,
        { paddingBottom: Math.max(Spacing.md, bottomInset) },
      ]}
    >
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={Colors.gray}
        value={text}
        onChangeText={setText}
        multiline
        maxLength={1000}
        editable={!isLoading}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
      />
      <TouchableOpacity
        style={[
          styles.sendButton,
          (isLoading || !text.trim()) && styles.sendButtonDisabled,
        ]}
        onPress={handleSend}
        disabled={isLoading || !text.trim()}
        activeOpacity={0.7}
      >
        {isLoading ? (
          <ActivityIndicator color={Colors.white} />
        ) : (
          <Send size={18} color={Colors.white} strokeWidth={2.2} />
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.lightGray,
  },
  containerFocused: {
    borderTopColor: Colors.primary,
  },
  input: {
    flex: 1,
    ...Typography.body,
    backgroundColor: Colors.offWhite,
    borderRadius: BorderRadius.round,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    maxHeight: 100,
    marginRight: Spacing.md,
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
