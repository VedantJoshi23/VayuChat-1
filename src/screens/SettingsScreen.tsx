import React, { useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, Text } from 'react-native';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';
import { Spacing } from '../theme/spacing';
import SettingItem from '../components/SettingItem';
import ModeSelector from '../components/ModeSelector';
import ModelPickerModal from '../components/ModelPickerModal';
import TokenizerPickerModal from '../components/TokenizerPickerModal';
import DatasetPickerModal from '../components/DatasetPickerModal';
import { useSettingsStore } from '../store/settingsStore';
import { useModelStore } from '../store/modelStore';
import { useDatasetStore } from '../store/datasetStore';
import { ModelLoader } from '../services/llmEngine/modelLoader';

export default function SettingsScreen() {
  const {
    mode,
    isDarkMode,
    setDarkMode,
    streamingEnabled,
    setStreamingEnabled,
    devMode,
    setDevMode,
  } = useSettingsStore();
  const { selectedModelId, selectedModelPath, selectedTokenizerPath, availableModels } =
    useModelStore();
  const { datasets } = useDatasetStore();

  const [modelPickerOpen, setModelPickerOpen] = useState(false);
  const [tokenizerPickerOpen, setTokenizerPickerOpen] = useState(false);
  const [datasetPickerOpen, setDatasetPickerOpen] = useState(false);

  const selectedModel = availableModels.find((m) => m.id === selectedModelId);
  const requiresTokenizer = useMemo(
    () =>
      selectedModel?.format === 'pte' ||
      ModelLoader.getModelFormat(selectedModelPath ?? '') === 'pte',
    [selectedModel?.format, selectedModelPath]
  );
  const selectedModelLabel =
    selectedModel?.name ?? selectedModelPath?.split('/').pop() ?? 'No model selected';
  const selectedTokenizerLabel = selectedTokenizerPath?.split('/').pop() ?? 'Not selected';

  const datasetSummary =
    datasets.length === 0
      ? 'No datasets loaded'
      : datasets.map((d) => `"${d.name}"`).join(', ');

  return (
    <>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>Inference</Text>
        <ModeSelector variant="full" />

        <SettingItem
          label="Model"
          description={selectedModelPath ?? 'Pick a .gguf, .pte, or .onnx file from device storage.'}
          value={selectedModelLabel}
          type="action"
          onPress={() => setModelPickerOpen(true)}
        />

        <SettingItem
          label="Tokenizer"
          description={
            requiresTokenizer
              ? selectedTokenizerPath ?? 'Required for ExecuTorch (.pte) models.'
              : 'Only needed for .pte (ExecuTorch) models.'
          }
          value={selectedTokenizerLabel}
          type="action"
          onPress={() => setTokenizerPickerOpen(true)}
          disabled={!requiresTokenizer}
        />

        <Text style={styles.sectionTitle}>Datasets</Text>
        <SettingItem
          label="Loaded tables"
          description={
            mode === 'tool_calling'
              ? 'CSV/JSON files available to the model as named tables.'
              : 'Only used in tool-calling mode.'
          }
          value={datasetSummary}
          type="action"
          onPress={() => setDatasetPickerOpen(true)}
        />

        <Text style={styles.sectionTitle}>Execution</Text>
        <SettingItem
          label="Current Mode"
          description={
            mode === 'tool_calling'
              ? 'Model generates function calls; app executes them against loaded datasets.'
              : 'Model generates Python code for direct execution.'
          }
          value={mode === 'tool_calling' ? 'Tool Calling' : 'Direct Inference'}
          type="text"
        />
        <SettingItem
          label="Stream Tokens"
          description="Display tokens as they are generated"
          value={streamingEnabled}
          onValueChange={setStreamingEnabled}
          type="toggle"
        />

        <Text style={styles.sectionTitle}>Developer</Text>
        <SettingItem
          label="Dev Mode"
          description={
            devMode
              ? 'Showing function calls, args, and execution steps in chat.'
              : 'Enable to see raw function calls and execution trace in chat (tool-calling mode only).'
          }
          value={devMode}
          onValueChange={setDevMode}
          type="toggle"
        />

        <Text style={styles.sectionTitle}>Display</Text>
        <SettingItem
          label="Dark Mode"
          description="Use dark theme (coming soon)"
          value={isDarkMode}
          onValueChange={setDarkMode}
          type="toggle"
        />

        <View style={styles.spacer} />
      </ScrollView>

      <ModelPickerModal visible={modelPickerOpen} onClose={() => setModelPickerOpen(false)} />
      <TokenizerPickerModal
        visible={tokenizerPickerOpen}
        onClose={() => setTokenizerPickerOpen(false)}
      />
      <DatasetPickerModal
        visible={datasetPickerOpen}
        onClose={() => setDatasetPickerOpen(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.offWhite,
    paddingTop: Spacing.lg,
  },
  sectionTitle: {
    ...Typography.h4,
    color: Colors.primary,
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
  },
  spacer: {
    height: Spacing.xl,
  },
});
