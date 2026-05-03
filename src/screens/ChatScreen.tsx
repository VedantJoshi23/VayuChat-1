import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Keyboard,
  KeyboardEvent,
  TouchableOpacity,
  NativeModules,
} from 'react-native';
import { useHeaderHeight } from '@react-navigation/elements';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../theme/colors';
import MessageList from '../components/MessageList';
import MessageInput from '../components/MessageInput';
import EmptyState from '../components/EmptyState';
import ModeSelector from '../components/ModeSelector';
import ModelStatusChip from '../components/ModelStatusChip';
import ModelPickerModal from '../components/ModelPickerModal';
import DatasetPickerModal from '../components/DatasetPickerModal';
import TokenizerPickerModal from '../components/TokenizerPickerModal';
import { DebugInfo } from '../components/FunctionCallDebugView';
import { Cpu, Database } from '../components/icons';
import { useChatStore } from '../store/chatStore';
import { useSettingsStore } from '../store/settingsStore';
import { useModelStore } from '../store/modelStore';
import { useDatasetStore, DatasetEntry } from '../store/datasetStore';
import { useLLMEngine } from '../hooks/useLLMEngine';
import { ChatRepository } from '../database/chatRepository';
import { MessageRepository } from '../database/messageRepository';
import { ModelLoader } from '../services/llmEngine/modelLoader';
import { Message } from '../types/chat';
import { DataFrameManager } from '../services/dataOperations/DataFrameManager';
import { loadDatasetRows, LoadProgress } from '../services/datasetManager/DatasetLoader';
import { parseFunctionCalls } from '../services/llmEngine/ToolCallingEngine';
import { TableSchema } from '../services/api/contextBuilder';


const chatRepo = new ChatRepository();
const msgRepo = new MessageRepository();
const { PythonModule } = NativeModules;

/**
 * Build a Python preamble that makes each loaded dataset available as a named
 * DataFrame variable inside code_runner.py's exec() scope.
 *
 * The pkl_utils / csv_utils modules cache their DataFrames in Python module-level
 * memory after the first getDatasetMetadata / loadDatasetChunk call, so calling
 * get_df() here is effectively free — it just returns the already-loaded object.
 * On a cold start (app restart) _get_df() will re-read the file transparently.
 */
function buildExecutionPreamble(datasets: DatasetEntry[]): string {
  const lines = datasets
    .filter((d) => d.columns.length > 0)   // only datasets whose schema we know
    .map((d) => {
      const p = d.path.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      switch (d.format) {
        case 'pkl':
          return `import pkl_utils as _pkl\n${d.name} = _pkl.get_df('${p}')`;
        case 'csv':
          return `import csv_utils as _csv\n${d.name} = _csv.get_df('${p}')`;
        case 'json':
          // JSON is small enough to reload inline; pandas read_json handles it.
          return `import pandas as _pd\n${d.name} = _pd.read_json('${p}')`;
        default:
          return '';
      }
    })
    .filter(Boolean);

  return lines.join('\n');
}

// Stable empty object so `debugInfoMap={devMode ? debugInfoMap : {}}` doesn't
// create a new object reference on every render when devMode is false — that
// would give MessageList / FlatList a new prop identity every frame and
// contribute to the VirtualizedList "Maximum update depth exceeded" loop.
const EMPTY_DEBUG_MAP: Record<string, never> = Object.freeze({}) as Record<string, never>;

export default function ChatScreen({ navigation }: any) {
  const {
    currentConversation,
    messages,
    isLoading,
    lastConversationId,
    setCurrentConversation,
    addMessage,
    setMessages,
    setIsLoading,
  } = useChatStore();
  const mode = useSettingsStore((s) => s.mode);
  const devMode = useSettingsStore((s) => s.devMode);
  const { selectedModelPath, availableModels, selectedModelId, selectedTokenizerPath, isHydrated } = useModelStore();
  const { datasets } = useDatasetStore();
  const selectedModel = availableModels.find((m) => m.id === selectedModelId);

  const [streamingContent, setStreamingContent] = useState('');
  const [streamingMessage, setStreamingMessage] = useState<Message | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [datasetPickerOpen, setDatasetPickerOpen] = useState(false);
  const [tokenizerPickerOpen, setTokenizerPickerOpen] = useState(false);
  // Per-dataset loading progress (name → 0–100)
  const [datasetProgress, setDatasetProgress] = useState<Record<string, number>>({});
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [debugInfoMap, setDebugInfoMap] = useState<Record<string, DebugInfo>>({});

  const dfManagerRef = useRef<DataFrameManager>(new DataFrameManager());
  const tablesLoadedRef = useRef<Set<string>>(new Set());
  // Tracks datasets whose load is currently IN PROGRESS (not yet complete).
  // Without this, a re-render caused by setDatasetProgress() can trigger the
  // [datasets] effect again before tablesLoadedRef is populated, making the
  // same dataset load concurrently 2-3 times.
  const tablesLoadingRef = useRef<Set<string>>(new Set());
  const sessionRestoredRef = useRef(false);

  // Streaming token batcher — accumulate tokens in a ref, flush to state on
  // the next animation frame.  Without this, every single token causes a full
  // React re-render → streamingMessage useEffect → setStreamingMessage →
  // another re-render → FlatList new data → VirtualizedList internal setState
  // loop → "Maximum update depth exceeded".
  const streamingBufferRef = useRef('');
  const streamingRafRef = useRef<ReturnType<typeof requestAnimationFrame> | null>(null);

  const llmEngine = useLLMEngine(selectedModelPath);
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();

  const tableSchemas = useMemo<TableSchema[]>(
    () =>
      datasets
        .filter((d) => d.columns.length > 0)
        .map((d) => ({ name: d.name, columns: d.columns, rowCount: d.rowCount })),
    [datasets]
  );

  // Load dataset files into DataFrameManager whenever the datasets list changes.
  // Uses chunked Python loading for pkl + large CSV so the JS thread is never
  // blocked for more than a few ms at a time.  JSON and tiny CSV files are
  // handled inline in JS as before.
  useEffect(() => {
    let cancelled = false;
    const manager = dfManagerRef.current;

    async function loadPendingDatasets() {
      // Exclude both already-loaded and currently-in-progress datasets so that
      // re-renders triggered by setDatasetProgress() don't start duplicate loads.
      const pending = datasets.filter(
        (d) =>
          !tablesLoadedRef.current.has(d.name) &&
          !tablesLoadingRef.current.has(d.name)
      );
      if (pending.length === 0) return;

      // Mark all pending as in-progress before the first await so subsequent
      // synchronous filter calls in the same tick see them as busy.
      pending.forEach((d) => tablesLoadingRef.current.add(d.name));

      // Load sequentially to avoid saturating the Python interpreter.
      for (const d of pending) {
        if (cancelled) break;
        try {
          const rows = await loadDatasetRows(
            d.path,
            d.format,
            d.size,
            (p: LoadProgress) => {
              if (cancelled) return;
              const pct =
                p.phase === 'metadata' ? 5
                : p.phase === 'done'   ? 100
                : p.totalRows > 0     ? Math.round(5 + (p.rowsLoaded / p.totalRows) * 94)
                : 10;
              setDatasetProgress((prev) => ({ ...prev, [d.name]: pct }));
            }
          );

          if (cancelled) break;
          manager.addTable(d.name, rows);
          tablesLoadedRef.current.add(d.name);
          console.log(`[DataFrameManager] loaded "${d.name}" (${rows.length} rows)`);
        } catch (e) {
          console.warn(`[DataFrameManager] failed to load "${d.name}":`, e);
        } finally {
          tablesLoadingRef.current.delete(d.name);
          setDatasetProgress((prev) => {
            const next = { ...prev };
            delete next[d.name];
            return next;
          });
        }
      }
    }

    loadPendingDatasets();
    return () => { cancelled = true; };
  }, [datasets]);

  const handleDatasetsChanged = useCallback(() => {
    tablesLoadedRef.current.clear();
    tablesLoadingRef.current.clear();
  }, []);

  // ── Session restore ────────────────────────────────────────────────────────
  // On first mount (after DB + store hydration), restore the most recent session.
  // We only do this once per mount to avoid clobbering a conversation the user
  // explicitly started via ChatHistoryScreen.
  useEffect(() => {
    if (!isHydrated || sessionRestoredRef.current) return;
    if (currentConversation) {
      // Already have a conversation in memory — no restore needed
      sessionRestoredRef.current = true;
      return;
    }
    if (!lastConversationId) {
      sessionRestoredRef.current = true;
      return;
    }

    sessionRestoredRef.current = true;
    chatRepo.getConversation(lastConversationId)
      .then(async (conv) => {
        if (!conv) return;
        const msgs = await msgRepo.getMessagesByConversation(conv.id);
        setCurrentConversation(conv as any);
        setMessages(msgs);
      })
      .catch((e) => console.warn('[ChatScreen] session restore failed:', e));
  }, [isHydrated, currentConversation, lastConversationId]);

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
        `Chat – ${new Date().toLocaleDateString()}`,
        selectedModel?.id ?? 'unknown',
        mode,
        ''
      );
      setCurrentConversation(conv);
    } catch (err) {
      console.error('[ChatScreen] Failed to create conversation:', err);
    }
  };

  // Flush any buffered streaming tokens to state and cancel the pending RAF.
  // Must be called before every setStreamingContent('') reset so a late-firing
  // RAF doesn't overwrite the cleared state with stale content.
  const flushStreamingBuffer = useCallback(() => {
    if (streamingRafRef.current !== null) {
      cancelAnimationFrame(streamingRafRef.current);
      streamingRafRef.current = null;
    }
    streamingBufferRef.current = '';
  }, []);

  const handleSendMessage = async (text: string) => {
    if (!currentConversation || !text.trim() || !llmEngine.isReady) return;

    // Guard: PTE models in Direct Inference mode require a tokenizer
    if (
      mode === 'direct_inference' &&
      selectedModelPath &&
      ModelLoader.getModelFormat(selectedModelPath) === 'pte' &&
      !selectedTokenizerPath
    ) {
      Alert.alert(
        'Tokenizer required',
        'You must select a tokenizer file before running inference with a .pte model.',
        [
          { text: 'Select tokenizer', onPress: () => setTokenizerPickerOpen(true) },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
      return;
    }

    setIsLoading(true);
    flushStreamingBuffer();
    setStreamingContent('');
    setStreamingMessage(null);

    try {
      // Save user message
      const userMsg = await msgRepo.createMessage(currentConversation.id, 'user', text);
      addMessage(userMsg);
      await chatRepo.incrementMessageCount(currentConversation.id);

      const nextMessages = [...messages, userMsg];

      const response = await llmEngine.generate(
        text,
        currentConversation,
        nextMessages,
        (token) => {
          // Batch every token that arrives within the same animation frame into
          // a single setState call.  Without this, rapid streaming (20+ tok/s)
          // causes a re-render chain that overwhelms VirtualizedList's internal
          // state machine and triggers "Maximum update depth exceeded".
          streamingBufferRef.current += token;
          if (streamingRafRef.current === null) {
            streamingRafRef.current = requestAnimationFrame(() => {
              streamingRafRef.current = null;
              setStreamingContent(streamingBufferRef.current);
            });
          }
        },
        tableSchemas
      );

      if (!response) throw new Error('No response from model');

      let displayContent = response.content;
      let debugInfo: DebugInfo | null = null;

      if (mode === 'tool_calling' && response.type === 'tool_calling') {
        // ── Tool-calling: execute DataFrameManager function pipeline ─────────
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
      } else if (mode === 'direct_inference' && response.code && PythonModule?.executePython) {
        // ── Direct inference: auto-execute generated Python code ─────────────
        // Prepend dataset loading so named DataFrames are available.
        // pkl_utils / csv_utils return from their in-memory cache making this
        // effectively free when datasets were already loaded by ChatScreen.
        const preamble = buildExecutionPreamble(datasets);
        const codeToRun = preamble ? `${preamble}\n\n${response.code}` : response.code;

        try {
          const execResult: { stdout: string; stderr: string; success: boolean } =
            await PythonModule.executePython(codeToRun, 30_000);

          const stdout = execResult.stdout?.trim();
          const stderr = execResult.stderr?.trim();

          // Keep the model's full response (includes the code block) and append
          // the execution output below a horizontal rule so the user sees both.
          if (stdout || stderr) {
            displayContent = response.content;
            if (stdout) {
              displayContent += `\n\n---\n**Output:**\n\`\`\`\n${stdout}\n\`\`\``;
            }
            if (stderr) {
              displayContent += `\n\n---\n**Error:**\n\`\`\`\n${stderr}\n\`\`\``;
            }
          }
        } catch (execErr) {
          // Execution failed entirely (Chaquopy not available, timeout, etc.).
          // Still show the model's response — the user can run the code manually.
          const errMsg = execErr instanceof Error ? execErr.message : String(execErr);
          displayContent = response.content + `\n\n---\n**Execution failed:** ${errMsg}`;
        }
      }

      // Cancel any pending RAF before clearing so a late frame-flush doesn't
      // overwrite the empty state with stale buffered tokens.
      flushStreamingBuffer();
      setStreamingContent('');
      setStreamingMessage(null);

      // Save assistant message
      const assistantMsg = await msgRepo.createMessage(
        currentConversation.id,
        'assistant',
        displayContent,
        userMsg.id,
        response.metrics ? { inference: response.metrics } : undefined
      );
      addMessage(assistantMsg);
      await chatRepo.incrementMessageCount(currentConversation.id);

      if (debugInfo) {
        setDebugInfoMap((prev) => ({ ...prev, [assistantMsg.id]: debugInfo! }));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      Alert.alert('Generation failed', msg);
      flushStreamingBuffer();
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
        debugInfoMap={devMode ? debugInfoMap : EMPTY_DEBUG_MAP}
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
              ? 'Ask about air quality…'
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
      <TokenizerPickerModal
        visible={tokenizerPickerOpen}
        onClose={() => setTokenizerPickerOpen(false)}
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
