import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Colors, Shadows } from '../theme/colors';
import { Typography } from '../theme/typography';
import { Spacing, BorderRadius } from '../theme/spacing';
import { FileJson, Folder, X } from './icons';
import { filePicker } from '../services/filePicker';
import { useModelStore } from '../store/modelStore';

interface TokenizerPickerModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function TokenizerPickerModal({
  visible,
  onClose,
}: TokenizerPickerModalProps) {
  const { selectedTokenizerPath, setSelectedTokenizerPath } = useModelStore();
  const [importing, setImporting] = useState(false);

  const handleBrowse = async () => {
    setImporting(true);
    try {
      const file = await filePicker.pickTokenizer();
      if (!file) return;
      const id = file.name.replace(/\.[^.]+$/, '');
      setSelectedTokenizerPath(file.path, id);
      onClose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Import failed';
      Alert.alert('Could not import tokenizer', msg);
    } finally {
      setImporting(false);
    }
  };

  const handleClear = () => {
    setSelectedTokenizerPath(null, null);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      presentationStyle="overFullScreen"
      statusBarTranslucent
      supportedOrientations={["portrait", "landscape"]}
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={[styles.sheet, Shadows.large]}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <FileJson size={22} color={Colors.primary} strokeWidth={2} />
              <Text style={styles.title}>Select Tokenizer</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={22} color={Colors.darkGray} />
            </TouchableOpacity>
          </View>

          <Text style={styles.subtitle}>
            For .pte (ExecuTorch) models, select the matching tokenizer file
            (.json, .bin, or .model). External tokenizers are required per
            executorch-examples.
          </Text>

          {selectedTokenizerPath && (
            <View style={styles.currentRow}>
              <Text style={styles.currentLabel}>Current:</Text>
              <Text style={styles.currentPath} numberOfLines={1}>
                {selectedTokenizerPath.split('/').pop()}
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.browseBtn, importing && styles.disabled]}
            onPress={handleBrowse}
            disabled={importing}
            activeOpacity={0.85}
          >
            <Folder size={20} color={Colors.white} strokeWidth={2} />
            <Text style={styles.browseText}>
              {importing ? 'Importing…' : 'Browse device'}
            </Text>
          </TouchableOpacity>

          {selectedTokenizerPath && (
            <TouchableOpacity
              style={styles.clearBtn}
              onPress={handleClear}
              activeOpacity={0.7}
            >
              <Text style={styles.clearText}>Clear selection</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingTop: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
    minHeight: 220,
    maxHeight: '70%',
  },
  handle: {
    width: 48,
    height: 4,
    backgroundColor: Colors.lightGray,
    borderRadius: BorderRadius.round,
    alignSelf: 'center',
    marginBottom: Spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  title: { ...Typography.h4, color: Colors.charcoal },
  subtitle: {
    ...Typography.bodySmall,
    color: Colors.darkGray,
    marginBottom: Spacing.lg,
    lineHeight: 20,
  },
  currentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.offWhite,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  currentLabel: {
    ...Typography.label,
    color: Colors.darkGray,
  },
  currentPath: {
    ...Typography.bodySmall,
    color: Colors.charcoal,
    flex: 1,
  },
  browseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  disabled: { opacity: 0.6 },
  browseText: {
    ...Typography.button,
    color: Colors.white,
    fontWeight: '600',
  },
  clearBtn: {
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  clearText: {
    ...Typography.bodySmall,
    color: Colors.error,
    fontWeight: '500',
  },
});
