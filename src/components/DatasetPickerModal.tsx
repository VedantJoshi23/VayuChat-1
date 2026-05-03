import React, { useState, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Colors, Shadows } from '../theme/colors';
import { Typography } from '../theme/typography';
import { Spacing, BorderRadius } from '../theme/spacing';
import {
  Database,
  Folder,
  X,
  Trash2,
  CheckCircle2,
  Table2,
  Info,
} from './icons';
import { filePicker } from '../services/filePicker';
import { useDatasetStore, DatasetEntry } from '../store/datasetStore';
import { getDatasetMeta } from '../services/datasetManager/DatasetLoader';

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Called after datasets change so the caller can reload tables */
  onDatasetsChanged?: () => void;
}

function formatSize(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return mb < 1 ? `${(bytes / 1024).toFixed(1)} KB` : `${mb.toFixed(1)} MB`;
}

export default function DatasetPickerModal({ visible, onClose, onDatasetsChanged }: Props) {
  const { datasets, addDataset, removeDataset, updateDatasetMeta } = useDatasetStore();
  const [importing, setImporting] = useState(false);
  const [pendingName, setPendingName] = useState('');
  const [pendingFile, setPendingFile] = useState<{ path: string; name: string; size: number; ext: string } | null>(null);

  const resetPending = () => {
    setPendingFile(null);
    setPendingName('');
  };

  const handleBrowse = async () => {
    setImporting(true);
    try {
      const file = await filePicker.pickDataset();
      if (!file) return;
      const defaultName = file.name.replace(/\.[^.]+$/, '');
      setPendingFile(file);
      setPendingName(defaultName);
    } catch (e) {
      Alert.alert('Import failed', e instanceof Error ? e.message : String(e));
    } finally {
      setImporting(false);
    }
  };

  const handleConfirmAdd = useCallback(async () => {
    if (!pendingFile || !pendingName.trim()) return;

    const name = pendingName.trim();
    const format = pendingFile.ext as 'csv' | 'json' | 'pkl';

    addDataset({ name, path: pendingFile.path, format, size: pendingFile.size });
    resetPending();

    // Extract column names + row count via lightweight metadata call.
    // getDatasetMeta() never serialises row data, so it is fast even on
    // 100 MB pkl files.  Actual rows are loaded lazily by ChatScreen when
    // the DataFrameManager first needs the table.
    try {
      const meta = await getDatasetMeta(pendingFile.path, format);
      updateDatasetMeta(name, {
        columns: meta.columns,
        rowCount: meta.rowCount,
        loadedAt: new Date().toISOString(),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      Alert.alert(
        `${format.toUpperCase()} preview unavailable`,
        `"${name}" was added but column info couldn't be read.\n\n${msg}`
      );
    }

    onDatasetsChanged?.();
  }, [pendingFile, pendingName, addDataset, updateDatasetMeta, onDatasetsChanged]);

  const handleRemove = (entry: DatasetEntry) => {
    Alert.alert(
      'Remove dataset',
      `Remove "${entry.name}" from the registry? The file is not deleted.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            removeDataset(entry.name);
            onDatasetsChanged?.();
          },
        },
      ]
    );
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
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Database size={22} color={Colors.primary} strokeWidth={2} />
              <Text style={styles.title}>Datasets</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={22} color={Colors.darkGray} />
            </TouchableOpacity>
          </View>

          <Text style={styles.subtitle}>
            Load CSV, JSON, or PKL (pickle) files as named tables for tool-calling mode.
          </Text>

          {/* Import button */}
          <TouchableOpacity
            style={[styles.browseBtn, importing && styles.disabled]}
            onPress={handleBrowse}
            disabled={importing}
            activeOpacity={0.85}
          >
            {importing ? (
              <ActivityIndicator color={Colors.white} size="small" />
            ) : (
              <Folder size={20} color={Colors.white} strokeWidth={2} />
            )}
            <Text style={styles.browseText}>{importing ? 'Importing…' : 'Browse device'}</Text>
          </TouchableOpacity>

          {/* Name confirmation row */}
          {pendingFile && (
            <View style={styles.nameRow}>
              <View style={styles.nameInputWrap}>
                <Text style={styles.nameLabel}>Table name</Text>
                <TextInput
                  style={styles.nameInput}
                  value={pendingName}
                  onChangeText={setPendingName}
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder="e.g. data, ncap_data"
                  placeholderTextColor={Colors.gray}
                />
              </View>
              <TouchableOpacity
                style={[styles.confirmBtn, !pendingName.trim() && styles.disabled]}
                onPress={handleConfirmAdd}
                disabled={!pendingName.trim()}
                activeOpacity={0.85}
              >
                <CheckCircle2 size={20} color={Colors.white} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelBtn} onPress={resetPending} activeOpacity={0.85}>
                <X size={18} color={Colors.darkGray} />
              </TouchableOpacity>
            </View>
          )}

          {/* Loaded datasets list */}
          <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
            {datasets.length === 0 && !pendingFile && (
              <View style={styles.emptyWrap}>
                <Info size={24} color={Colors.gray} />
                <Text style={styles.emptyHint}>
                  No datasets loaded.{'\n'}Import a .csv, .json, or .pkl file to get started.
                </Text>
              </View>
            )}
            {datasets.map((d) => (
              <View key={d.name} style={styles.row}>
                <View style={styles.rowIcon}>
                  <Table2 size={18} color={Colors.primaryDark} strokeWidth={1.8} />
                </View>
                <View style={styles.rowText}>
                  <Text style={styles.rowName}>
                    <Text style={styles.rowKey}>"{d.name}"</Text>
                    {'  '}
                    <Text style={styles.rowFormat}>{d.format.toUpperCase()}</Text>
                  </Text>
                  <Text style={styles.rowMeta}>
                    {d.rowCount > 0
                      ? `${d.rowCount.toLocaleString()} rows · ${d.columns.length} cols`
                      : formatSize(d.size)}
                    {d.loadedAt ? '' : ' · not loaded yet'}
                  </Text>
                  {d.columns.length > 0 && (
                    <Text style={styles.rowCols} numberOfLines={1}>
                      {d.columns.slice(0, 6).join(', ')}
                      {d.columns.length > 6 ? ` +${d.columns.length - 6}` : ''}
                    </Text>
                  )}
                </View>
                <TouchableOpacity
                  onPress={() => handleRemove(d)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Trash2 size={18} color={Colors.error} strokeWidth={1.8} />
                </TouchableOpacity>
              </View>
            ))}
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
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  title: { ...Typography.h4, color: Colors.charcoal },
  subtitle: { ...Typography.bodySmall, color: Colors.darkGray, marginBottom: Spacing.lg },
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
  disabled: { opacity: 0.5 },
  browseText: { ...Typography.button, color: Colors.white, fontWeight: '600' },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.sm,
    backgroundColor: Colors.offWhite,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  nameInputWrap: { flex: 1 },
  nameLabel: { ...Typography.caption, color: Colors.primary, marginBottom: 4, fontWeight: '600' },
  nameInput: {
    ...Typography.body,
    color: Colors.charcoal,
    borderBottomWidth: 1,
    borderBottomColor: Colors.primary,
    paddingVertical: 4,
  },
  confirmBtn: {
    backgroundColor: Colors.secondary,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
  },
  cancelBtn: {
    backgroundColor: Colors.lightGray,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
  },
  list: { maxHeight: 320 },
  listContent: { paddingBottom: Spacing.md },
  emptyWrap: { alignItems: 'center', paddingVertical: Spacing.xl, gap: Spacing.sm },
  emptyHint: { ...Typography.bodySmall, color: Colors.gray, textAlign: 'center' },
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
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: `${Colors.primary}16`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1 },
  rowName: { ...Typography.body, color: Colors.charcoal, fontWeight: '500' },
  rowKey: { color: Colors.primary },
  rowFormat: { ...Typography.caption, color: Colors.darkGray },
  rowMeta: { ...Typography.caption, color: Colors.darkGray, marginTop: 2 },
  rowCols: { ...Typography.caption, color: Colors.gray, marginTop: 2, fontStyle: 'italic' },
});
