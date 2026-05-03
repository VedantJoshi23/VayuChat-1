import { useEffect, useRef, useState, useCallback } from 'react';
import { ToolCallingEngine } from '../services/llmEngine/ToolCallingEngine';
import { DirectInferenceEngine } from '../services/llmEngine/DirectInferenceEngine';
import { NativeInferenceEngine, isNativeInferenceAvailable } from '../services/llmEngine/nativeInference';
import { LLMEngine, BaseLLMEngine } from '../services/llmEngine/LLMEngine';
import { ModelLoader } from '../services/llmEngine/modelLoader';
import * as llamaRNBridge from '../services/llmEngine/llamaRNBridge';
import { Message, Conversation } from '../types/chat';
import { Response, StreamEvent } from '../types/common';
import { InferenceConfig } from '../types/models';
import {
  buildContextPrompt,
  buildOAIMessages,
  buildToolCallingSystemPrompt,
  buildDirectInferenceSystemPrompt,
  TableSchema,
} from '../services/api/contextBuilder';
import { useSettingsStore } from '../store/settingsStore';
import { useModelStore } from '../store/modelStore';
import { tokenizerRegistry } from '../services/llmEngine/tokenizerRegistry';

const MODEL_LOAD_TIMEOUT_MS = 60_000;

interface UseLLMEngineState {
  isReady: boolean;
  isGenerating: boolean;
  error: string | null;
  engine: LLMEngine | null;
}

/**
 * Races `promise` against a timeout. The timer is always cleared after the
 * race settles so it never fires later and creates an orphaned rejected
 * Promise (which Hermes treats as fatal in release builds).
 *
 * The underlying `promise` may still be pending after the timeout wins — we
 * attach a no-op `.catch()` so that if it eventually rejects it is silently
 * swallowed rather than becoming another unhandled rejection.
 */
function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timerId: ReturnType<typeof setTimeout>;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timerId = setTimeout(() => reject(new Error(message)), ms);
  });

  // Swallow any late rejection from the original promise so it never becomes
  // an unhandled rejection after the timeout has already won the race.
  promise.catch(() => undefined);

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timerId);
  }) as Promise<T>;
}

export function useLLMEngine(modelPath: string | null) {
  const [state, setState] = useState<UseLLMEngineState>({
    isReady: false,
    isGenerating: false,
    error: null,
    engine: null,
  });
  const [reloadKey, setReloadKey] = useState(0);

  const engineRef = useRef<BaseLLMEngine | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const initPromiseRef = useRef<Promise<void> | null>(null);
  const mode = useSettingsStore((s) => s.mode);
  const { availableModels, selectedModelId, selectedTokenizerPath } = useModelStore();

  const selectedModel = availableModels.find((m) => m.id === selectedModelId);

  useEffect(() => {
    let mounted = true;

    async function init() {
      // Abort any previous in-flight init
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }

      // Unload previous engine
      const prevEngine = engineRef.current;
      engineRef.current = null;
      if (prevEngine) {
        prevEngine.unload().catch(() => undefined);
      }

      if (!modelPath) {
        if (mounted) {
          setState({ isReady: false, isGenerating: false, error: null, engine: null });
        }
        return;
      }

      if (mounted) {
        setState({ isReady: false, isGenerating: false, error: null, engine: null });
      }

      const initAbort = new AbortController();
      abortRef.current = initAbort;

      // Tracks an engine that started initializing but may not yet be assigned
      // to engineRef — needed so we can clean it up if init fails mid-way.
      let engineInProgress: BaseLLMEngine | null = null;

      try {
        await ModelLoader.loadModel(modelPath);
        const modelFormat = ModelLoader.getModelFormat(modelPath);

        if (modelFormat === 'onnx') {
          throw new Error('ONNX inference is not yet supported.');
        }

        const config: InferenceConfig = {
          modelId:
            selectedModel?.id ??
            modelPath.split('/').pop()?.replace(/\.[^.]+$/, '') ??
            'unknown',
          modelPath,
          tokenizerPath: selectedTokenizerPath ?? selectedModel?.tokenizerPath,
          temperature: selectedModel?.temperature ?? 0.7,
          maxTokens: selectedModel?.maxTokens ?? 512,
          contextWindow: selectedModel?.contextWindow ?? 2048,
          topK: 40,
          topP: 0.9,
          streamTokens: true,
        };

        if (modelFormat === 'pte') {
          // ── ExecuTorch PTE path ─────────────────────────────────────────
          if (!isNativeInferenceAvailable()) {
            throw new Error(
              'PTE inference requires Android with the ExecuTorch AAR. ' +
                'This device/build does not support it.'
            );
          }
          if (!config.tokenizerPath) {
            throw new Error(
              'A tokenizer file is required to load a .pte model. ' +
                'Please select a tokenizer (.bin or .model) in Settings.'
            );
          }

          const nativeEngine = new NativeInferenceEngine();
          engineInProgress = nativeEngine;

          await withTimeout(
            nativeEngine.initialize(config),
            MODEL_LOAD_TIMEOUT_MS,
            `Model loading timed out after ${MODEL_LOAD_TIMEOUT_MS / 1000}s`
          );

          engineInProgress = null;

          if (initAbort.signal.aborted || !mounted) {
            nativeEngine.unload().catch(() => undefined);
            return;
          }

          engineRef.current = nativeEngine;
          setState({
            isReady: true,
            isGenerating: false,
            error: null,
            engine: nativeEngine as LLMEngine,
          });
          return;
        }

        // ── GGUF path (llama.rn) ────────────────────────────────────────
        await withTimeout(
          llamaRNBridge.loadModel(modelPath, {
            numThreads: 4,
            contextWindow: config.contextWindow,
          }),
          MODEL_LOAD_TIMEOUT_MS,
          `Model loading timed out after ${MODEL_LOAD_TIMEOUT_MS / 1000}s`
        );

        if (initAbort.signal.aborted || !mounted) return;

        const engine: BaseLLMEngine =
          mode === 'tool_calling' ? new ToolCallingEngine() : new DirectInferenceEngine();

        engineInProgress = engine;
        await engine.initialize(config);
        engineInProgress = null;

        if (initAbort.signal.aborted || !mounted) {
          engine.unload().catch(() => undefined);
          return;
        }

        engineRef.current = engine;
        setState({
          isReady: true,
          isGenerating: false,
          error: null,
          engine: engine as LLMEngine,
        });
      } catch (e) {
        // Clean up any partially-initialized engine
        if (engineInProgress) {
          engineInProgress.unload().catch(() => undefined);
          engineInProgress = null;
        }

        if (initAbort.signal.aborted || !mounted) return;

        const msg = e instanceof Error ? e.message : 'Failed to initialize engine';
        console.error('[useLLMEngine] init error:', msg);

        engineRef.current = null;
        setState({ isReady: false, isGenerating: false, error: msg, engine: null });
      } finally {
        initPromiseRef.current = null;
        if (abortRef.current === initAbort) {
          abortRef.current = null;
        }
      }
    }

    const initPromise = init();
    initPromiseRef.current = initPromise;

    return () => {
      mounted = false;
    };
  }, [modelPath, mode, selectedModelId, selectedTokenizerPath, reloadKey]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      engineRef.current?.unload().catch(() => undefined);
    };
  }, []);

  const generate = useCallback(
    async (
      userQuery: string,
      conversation: Conversation,
      messages: Message[],
      onToken: (token: string) => void,
      tableSchemas?: TableSchema[]
    ): Promise<Response | null> => {
      if (!state.isReady || !engineRef.current) {
        if (initPromiseRef.current) {
          await initPromiseRef.current;
        }
      }

      if (!engineRef.current || !engineRef.current.isReady()) {
        throw new Error(state.error || 'Engine not ready — try reloading the model.');
      }

      const systemPrompt =
        mode === 'tool_calling'
          ? buildToolCallingSystemPrompt(tableSchemas ?? [])
          : buildDirectInferenceSystemPrompt();

      const conversationWithSystem: Conversation = { ...conversation, systemPrompt };

      const ctxOpts = {
        includeSystemPrompt: true,
        maxContextMessages: 20,
        maxContextTokens: selectedModel?.contextWindow
          ? selectedModel.contextWindow - 512
          : 2048,
      };

      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      setState((prev) => ({ ...prev, isGenerating: true, error: null }));

      const onStreamEvent = (event: StreamEvent) => {
        if (event.type === 'token') onToken(event.content);
      };

      try {
        const activeEngine = engineRef.current;
        if (!activeEngine) throw new Error('Engine was unloaded before generation could start.');

        const modelFormat = modelPath ? ModelLoader.getModelFormat(modelPath) : 'unknown';
        const isPTE = modelFormat === 'pte';

        let response: Response;

        if (!isPTE && activeEngine.generateWithMessages) {
          // ── GGUF path: use the model's embedded chat template ─────────────
          // Correct prompt formatting prevents the model from immediately
          // generating its EOS token (the "one token in 68 s" bug).
          const oaiMessages = buildOAIMessages(
            userQuery,
            messages,
            conversationWithSystem,
            ctxOpts
          );
          response = await activeEngine.generateWithMessages(
            oaiMessages,
            onStreamEvent,
            ctrl.signal
          );
        } else {
          // ── PTE path: raw prompt (ExecuTorch doesn't use chat templates) ──
          const fullPrompt = buildContextPrompt(
            userQuery,
            messages,
            conversationWithSystem,
            ctxOpts
          );
          response = await activeEngine.generate(fullPrompt, onStreamEvent, ctrl.signal);
        }

        // Auto-reload llama.rn bridge if evicted between requests (GGUF only)
        if (!response.content && !isPTE && modelPath && !llamaRNBridge.isLoaded()) {
          await llamaRNBridge.loadModel(modelPath, {
            numThreads: 6,
            contextWindow: selectedModel?.contextWindow ?? 2048,
          });
          // Re-run with same path
          if (!isPTE && activeEngine.generateWithMessages) {
            const oaiMessages = buildOAIMessages(userQuery, messages, conversationWithSystem, ctxOpts);
            response = await activeEngine.generateWithMessages(oaiMessages, onStreamEvent, ctrl.signal);
          } else {
            const fullPrompt = buildContextPrompt(userQuery, messages, conversationWithSystem, ctxOpts);
            response = await activeEngine.generate(fullPrompt, onStreamEvent, ctrl.signal);
          }
        }

        const promptTokens = tokenizerRegistry.estimatePromptTokens(
          buildContextPrompt(userQuery, messages, conversationWithSystem, ctxOpts)
        );
        if (response?.metrics) response.metrics.promptTokens = promptTokens;

        setState((prev) => ({ ...prev, isGenerating: false }));
        return response;
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Generation failed';
        const isGGUF = modelPath && ModelLoader.getModelFormat(modelPath) !== 'pte';

        // One-shot reload for transient GGUF "model not loaded" errors
        if (isGGUF && modelPath && (message.includes('Model not loaded') || message.includes('not initialized'))) {
          try {
            await llamaRNBridge.loadModel(modelPath, {
              numThreads: 6,
              contextWindow: selectedModel?.contextWindow ?? 2048,
            });
            const retryEngine = engineRef.current;
            if (!retryEngine) throw new Error('Engine unavailable after reload.');

            let retryResponse: Response;
            if (retryEngine.generateWithMessages) {
              const oaiMessages = buildOAIMessages(userQuery, messages, conversationWithSystem, ctxOpts);
              retryResponse = await retryEngine.generateWithMessages(oaiMessages, onStreamEvent, ctrl.signal);
            } else {
              const fullPrompt = buildContextPrompt(userQuery, messages, conversationWithSystem, ctxOpts);
              retryResponse = await retryEngine.generate(fullPrompt, onStreamEvent, ctrl.signal);
            }

            setState((prev) => ({ ...prev, isGenerating: false, error: null }));
            return retryResponse;
          } catch (retryError) {
            const retryMsg = retryError instanceof Error ? retryError.message : 'Generation failed';
            setState((prev) => ({ ...prev, isGenerating: false, error: retryMsg }));
            throw retryError;
          }
        }

        setState((prev) => ({ ...prev, isGenerating: false, error: message }));
        throw e;
      } finally {
        if (abortRef.current === ctrl) abortRef.current = null;
      }
    },
    [state.isReady, state.error, mode, selectedModel?.contextWindow, modelPath]
  );

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setState((prev) => ({ ...prev, isGenerating: false }));
  }, []);

  const retryLoad = useCallback(() => {
    setState({ isReady: false, isGenerating: false, error: null, engine: null });
    engineRef.current?.unload().catch(() => undefined);
    engineRef.current = null;
    setReloadKey((prev) => prev + 1);
  }, []);

  return {
    ...state,
    generate,
    cancel,
    retryLoad,
    resetError: () => setState((prev) => ({ ...prev, error: null })),
  };
}
