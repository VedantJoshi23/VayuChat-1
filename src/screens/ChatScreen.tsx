import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Keyboard,
  KeyboardEvent,
  NativeModules,
  TouchableOpacity,
} from 'react-native';
import { useHeaderHeight } from '@react-navigation/elements';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import RNFS from 'react-native-fs';
import { Colors } from '../theme/colors';
import MessageList from '../components/MessageList';
import MessageInput from '../components/MessageInput';
import EmptyState from '../components/EmptyState';
import ModeSelector from '../components/ModeSelector';
import ModelStatusChip from '../components/ModelStatusChip';
import ModelPickerModal from '../components/ModelPickerModal';
import DatasetPickerModal from '../components/DatasetPickerModal';
import { DebugInfo } from '../components/FunctionCallDebugView';
import { Cpu, Database } from '../components/icons';
import { useChatStore } from '../store/chatStore';
import { useSettingsStore } from '../store/settingsStore';
import { useModelStore } from '../store/modelStore';
import { useDatasetStore } from '../store/datasetStore';
import { useLLMEngine } from '../hooks/useLLMEngine';
import { ChatRepository } from '../database/chatRepository';
import { MessageRepository } from '../database/messageRepository';
import { Message } from '../types/chat';
import {
  DataFrameManager,
  parseCSV,
  parseJSON,
  Row,
} from '../services/dataOperations/DataFrameManager';
import { parseFunctionCalls } from '../services/llmEngine/ToolCallingEngine';
import { TableSchema } from '../services/api/contextBuilder';

// All imports must come before any executable statements
const { PythonModule } = NativeModules;

const chatRepo = new ChatRepository();
const msgRepo = new MessageRepository();

export default function ChatScreen({ navigation }: any) {
  const {
    currentConversation,
    messages,
    isLoading,
    setCurrentConversation,
    addMessage,
    setMessages,
    setIsLoading,
  } = useChatStore();
  const mode = useSettingsStore((s) => s.mode);
  const devMode = useSettingsStore((s) => s.devMode);
  const { selectedModelPath, availableModels, selectedModelId, isHydrated } = useModelStore();
  const { datasets } = useDatasetStore();
  const selectedModel = availableModels.find((m) => m.id === selectedModelId);

  const [streamingContent, setStreamingContent] = useState('');
  const [streamingMessage, setStreamingMessage] = useState<Message | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [datasetPickerOpen, setDatasetPickerOpen] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [debugInfoMap, setDebugInfoMap] = useState<Record<string, DebugInfo>>({});

  const dfManagerRef = useRef<DataFrameManager>(new DataFrameManager());
  const tablesLoadedRef = useRef<Set<string>>(new Set());

  const llmEngine = useLLMEngine(selectedModelPath);
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();

  // Table schemas derived from loaded datasets — passed to the system prompt
  const tableSchemas = useMemo<TableSchema[]>(
    () =>
      datasets
        .filter((d) => d.columns.length > 0)
        .map((d) => ({ name: d.name, columns: d.columns, rowCount: d.rowCount })),
    [datasets]
  );

  // Load dataset files into DataFrameManager whenever the datasets list changes.
  // FIX: forEach(async) is fire-and-forget — tables might not be ready before the
  // LLM generates its first tool call.  Use Promise.allSettled so all async loads
  // complete together, and mount-guard the result to avoid state updates after unmount.
  useEffect(() => {
    let cancelled = false;
    const manager = dfManagerRef.current;

    async function loadPendingDatasets() {
      // Build the list of datasets that still need loading
      const pending = datasets.filter((d) => !tablesLoadedRef.current.has(d.name));
      if (pending.length === 0) return;

      const results = await Promise.allSettled(
        pending.map(async (d) => {
          let rows: Row[] = [];

          if (d.format === 'pkl') {
            // PKL requires Android + Chaquopy native module
            if (!PythonModule?.loadPickleAsJson) {
              throw new Error(
                `"${d.name}": PKL files require the Chaquopy Python module ` +
                  '(Android only). Re-build the app with Chaquopy enabled, ' +
                  'or convert this file to CSV/JSON.'
              );
            }
            const jsonStr: string = await PythonModule.loadPickleAsJson(d.path);
            rows = JSON.parse(jsonStr) as Row[];
          } else if (d.format === 'csv') {
            const text = await RNFS.readFile(d.path, 'utf8');
            rows = parseCSV(text);
          } else {
            // json
            const text = await RNFS.readFile(d.path, 'utf8');
            rows = parseJSON(text);
          }

          return { name: d.name, rows };
        })
      );

      if (cancelled) return;

      results.forEach((result, i) => {
        if (result.status === 'fulfilled') {
          const { name, rows } = result.value;
          manager.addTable(name, rows);
          tablesLoadedRef.current.add(name);
          console.log(`DataFrameManager: loaded "${name}" (${rows.length} rows)`);
        } else {
          console.warn(
            `DataFrameManager: failed to load "${pending[i].name}":`,
            result.reason
          );
        }
      });
    }

    loadPendingDatasets();

    return () => {
      cancelled = true;
    };
  }, [datasets]);

  const handleDatasetsChanged = useCallback(() => {
    tablesLoadedRef.current.clear();
  }, []);

  const renderedMessages = useMemo(
    () => (streamingMessage ? [...messages, streamingMessage] : messages),
    [messages, streamingMessage]
  );

  useEffect(() => {
    if (selectedModelPath && !currentConversation && isHydrated) {
      initializeNewConversation();
    }
  }, [selectedModelPath, currentConversation, isHydrated]);

  useEffect(() => {
    if (!currentConversation) setMessages([]);
  }, [currentConversation, setMessages]);

  useEffect(() => {
    if (!currentConversation || !streamingContent) {
      setStreamingMessage(null);
      return;
    }
    setStreamingMessage({
      id: 'streaming-assistant-message',
      conversationId: currentConversation.id,
      role: 'assistant',
      content: streamingContent,
      timestamp: Date.now(),
    });
  }, [currentConversation, streamingContent]);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const onShow = (e: KeyboardEvent) => setKeyboardHeight(e.endCoordinates.height);
    const onHide = () => setKeyboardHeight(0);
    const showSub = Keyboard.addListener('keyboardDidShow', onShow);
    const hideSub = Keyboard.addListener('keyboardDidHide', onHide);
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  useLayoutEffect(() => {
    if (!navigation) return;
    const chipState: 'ready' | 'loading' | 'error' | 'idle' =
      llmEngine.error ? 'error'
      : llmEngine.isReady ? 'ready'
      : selectedModelPath ? 'loading'
      : 'idle';

    navigation.setOptions({
      headerTitle: () => (
        <ModelStatusChip
          modelName={selectedModel?.name ?? (selectedModelPath ? 'Model' : null)}
          state={chipState}
          onPress={() => setPickerOpen(true)}
          onRefresh={selectedModelPath ? llmEngine.retryLoad : undefined}
        />
      ),
      headerRight: () => (
        <View style={styles.headerRight}>
          {mode === 'tool_calling' && (
            <TouchableOpacity
              onPress={() => setDatasetPickerOpen(true)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={[styles.datasetBtn, datasets.length > 0 && styles.datasetBtnActive]}
            >
              <Database
                size={18}
                color={datasets.length > 0 ? Colors.primary : Colors.darkGray}
                strokeWidth={2}
              />
            </TouchableOpacity>
          )}
          <ModeSelector variant="compact" />
        </View>
      ),
    });
  }, [
    navigation,
    selectedModel?.name,
    selectedModelPath,
    llmEngine.isReady,
    llmEngine.error,
    llmEngine.retryLoad,
    mode,
    datasets.length,
  ]);

  const initializeNewConversation = async () => {
    try {
      const conv = await chatRepo.createConversation(
        `Chat - ${new Date().toLocaleDateString()}`,
        selectedModel?.id ?? 'unknown',
        mode,
        ''  // System prompt is always injected fresh per-request in useLLMEngine
      );
      setCurrentConversation(conv);
    } catch (err) {
      console.error('Failed to create conversation:', err);
    }
  };

  const handleSendMessage = async (text: string) => {
    if (!currentConversation || !text.trim() || !llmEngine.isReady) return;

    setIsLoading(true);
    setStreamingContent('');
    setStreamingMessage(null);

    try {
      const userMsg = await msgRepo.createMessage(currentConversation.id, 'user', text);
      addMessage(userMsg);
      const nextMessages = [...messages, userMsg];

      const response = await llmEngine.generate(
        text,
        currentConversation,
        nextMessages,
        (token) => setStreamingContent((prev) => prev + token),
        tableSchemas
      );

      if (!response) throw new Error('No response from model');

      let displayContent = response.content;
      let debugInfo: DebugInfo | null = null;

      // Execute tool calls and replace content with the execution result
      if (mode === 'tool_calling' && response.type === 'tool_calling') {
        const functionCalls = parseFunctionCalls(response.content);
        if (functionCalls.length > 0) {
          const execResult = dfManagerRef.current.executeCalls(functionCalls);
          displayContent = execResult.error
            ? `Error: ${execResult.error}`
            : execResult.finalResult || '(no result)';

          if (devMode) {
            debugInfo = {
              rawOutput: response.content,
              steps: execResult.steps,
              finalResult: execResult.finalResult,
              error: execResult.error,
            };
          }
        }
      }

      setStreamingContent('');
      setStreamingMessage(null);

      const assistantMsg = await msgRepo.createMessage(
        currentConversation.id,
        'assistant',
        displayContent,
        userMsg.id,
        response.metrics ? { inference: response.metrics } : undefined
      );
      addMessage(assistantMsg);

      if (debugInfo) {
        setDebugInfoMap((prev) => ({ ...prev, [assistantMsg.id]: debugInfo! }));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      Alert.alert('Generation failed', msg);
      setStreamingContent('');
      setStreamingMessage(null);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isHydrated) {
    return <View style={styles.container} />;
  }

  if (!selectedModelPath) {
    return (
      <View style={styles.container}>
        <EmptyState
          icon={Cpu}
          title="Select a model to begin"
          body="Pick a .gguf, .pte, or .onnx file from your device storage. Your selection will be remembered for future sessions."
          ctaLabel="Select Model"
          onCtaPress={() => setPickerOpen(true)}
          tone="info"
        />
        <ModelPickerModal visible={pickerOpen} onClose={() => setPickerOpen(false)} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MessageList
        messages={renderedMessages}
        isLoading={isLoading}
        debugInfoMap={devMode ? debugInfoMap : {}}
      />
      {streamingContent.length > 0 && <View style={styles.streamingIndicator} />}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={headerHeight}
        enabled={Platform.OS === 'ios'}
      >
        <MessageInput
          onSend={handleSendMessage}
          isLoading={isLoading || !llmEngine.isReady}
          bottomInset={
            Math.max(insets.bottom, 0) + (Platform.OS === 'android' ? keyboardHeight : 0)
          }
          placeholder={
            llmEngine.isReady
              ? mode === 'tool_calling' && datasets.length === 0
                ? 'Load a dataset first (tap the table icon above)…'
                : 'Ask about air quality…'
              : llmEngine.error
              ? 'Model failed to load'
              : 'Loading model…'
          }
        />
      </KeyboardAvoidingView>
      <ModelPickerModal visible={pickerOpen} onClose={() => setPickerOpen(false)} />
      <DatasetPickerModal
        visible={datasetPickerOpen}
        onClose={() => setDatasetPickerOpen(false)}
        onDatasetsChanged={handleDatasetsChanged}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.offWhite,
  },
  streamingIndicator: {
    height: 2,
    backgroundColor: Colors.cyan,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingRight: 8,
  },
  datasetBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: Colors.white,
  },
  datasetBtnActive: {
    backgroundColor: `${Colors.primary}15`,
  },
});
