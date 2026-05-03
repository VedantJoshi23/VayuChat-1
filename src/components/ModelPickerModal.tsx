import React, { useEffect, useState, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { Colors, Shadows } from '../theme/colors';
import { Typography } from '../theme/typography';
import { Spacing, BorderRadius } from '../theme/spacing';
import { Cpu, Folder, X, CheckCircle2, FileText } from './icons';
import { ModelLoader } from '../services/llmEngine/modelLoader';
import { filePicker } from '../services/filePicker';
import { useModelStore } from '../store/modelStore';
import { ModelConfig } from '../types/models';

interface ModelPickerModalProps {
  visible: boolean;
  onClose: () => void;
}

function formatSize(bytes: number): string {
  if (!bytes) return '–';
  const mb = bytes / (1024 * 1024);
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

export default function ModelPickerModal({ visible, onClose }: ModelPickerModalProps) {
  const {
    availableModels,
    selectedModelPath,
    setAvailableModels,
    addModel,
    selectModel,
    setSelectedModelPath,
  } = useModelStore();
  const [scanning, setScanning] = useState(false);
  const [importing, setImporting] = useState(false);

  const rescan = useCallback(async () => {
    setScanning(true);
    try {
      const models = await ModelLoader.scanDownloadsForModels();
      setAvailableModels(models);
    } catch (e) {
      console.warn('scan failed', e);
    } finally {
      setScanning(false);
    }
  }, [setAvailableModels]);

  useEffect(() => {
    if (visible) rescan();
  }, [visible, rescan]);

  const handleBrowse = async () => {
    setImporting(true);
    try {
      const file = await filePicker.pickModel();
      if (!file) return;
      const id = file.name.replace(/\.[^.]+$/, '');
      const model: ModelConfig = {
        id,
        name: id,
        path: file.path,
        format: file.ext as ModelConfig['format'],
        size: file.size,
        contextWindow: 2048,
        temperature: 0.7,
        maxTokens: 1024,
      };
      addModel(model);
      selectModel(model.id);
      setSelectedModelPath(model.path, model.id);
      onClose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Import failed';
      Alert.alert('Could not import model', msg);
    } finally {
      setImporting(false);
    }
  };

  const handleSelect = (m: ModelConfig) => {
    addModel(m);
    selectModel(m.id);
    setSelectedModelPath(m.path, m.id);
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
              <Cpu size={22} color={Colors.primary} strokeWidth={2} />
              <Text style={styles.title}>Select Model</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={22} color={Colors.darkGray} />
            </TouchableOpacity>
          </View>

          <Text style={styles.subtitle}>
            Pick a model file (.gguf, .pte, .onnx) from device storage.
          </Text>

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

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or pick from Downloads</Text>
            <View style={styles.dividerLine} />
          </View>

          <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
            {scanning && (
              <View style={styles.scanning}>
                <ActivityIndicator color={Colors.primary} />
                <Text style={styles.scanningText}>Scanning Downloads…</Text>
              </View>
            )}
            {!scanning && availableModels.length === 0 && (
              <Text style={styles.emptyHint}>
                No models found in Downloads. Use “Browse device” to import one.
              </Text>
            )}
            {availableModels.map((m) => {
              const isSelected = m.path === selectedModelPath;
              return (
                <TouchableOpacity
                  key={m.id}
                  style={[styles.row, isSelected && styles.rowSelected]}
                  onPress={() => handleSelect(m)}
                  activeOpacity={0.7}
                >
                  <View style={styles.rowIcon}>
                    <FileText
                      size={20}
                      color={isSelected ? Colors.primary : Colors.darkGray}
                      strokeWidth={1.6}
                    />
                  </View>
                  <View style={styles.rowText}>
                    <Text style={styles.rowName} numberOfLines={1}>
                      {m.name}
                    </Text>
                    <Text style={styles.rowMeta}>
                      {m.format.toUpperCase()} · {formatSize(m.size)}
                    </Text>
                  </View>
                  {isSelected && <CheckCircle2 size={20} color={Colors.primary} />}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
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
    minHeight: 260,
    maxHeight: '85%',
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
  title: {
    ...Typography.h4,
    color: Colors.charcoal,
  },
  subtitle: {
    ...Typography.bodySmall,
    color: Colors.darkGray,
    marginBottom: Spacing.lg,
  },
  browseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
  },
  disabled: { opacity: 0.6 },
  browseText: {
    ...Typography.button,
    color: Colors.white,
    fontWeight: '600',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.lightGray,
  },
  dividerText: {
    ...Typography.caption,
    color: Colors.gray,
    paddingHorizontal: Spacing.sm,
  },
  list: { maxHeight: 360 },
  listContent: { paddingBottom: Spacing.md },
  scanning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    justifyContent: 'center',
  },
  scanningText: {
    ...Typography.bodySmall,
    color: Colors.darkGray,
  },
  emptyHint: {
    ...Typography.bodySmall,
    color: Colors.gray,
    textAlign: 'center',
    paddingVertical: Spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.offWhite,
    marginBottom: Spacing.sm,
    gap: Spacing.md,
  },
  rowSelected: {
    backgroundColor: `${Colors.primary}11`,
    borderWidth: 1,
    borderColor: `${Colors.primary}55`,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.lightGray,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1 },
  rowName: {
    ...Typography.body,
    color: Colors.charcoal,
    fontWeight: '500',
  },
  rowMeta: {
    ...Typography.caption,
    color: Colors.darkGray,
    marginTop: 2,
  },
});
