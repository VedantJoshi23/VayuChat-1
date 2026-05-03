import { useEffect, useRef, useState, useCallback } from 'react';
import { ToolCallingEngine } from '../services/llmEngine/ToolCallingEngine';
import { DirectInferenceEngine } from '../services/llmEngine/DirectInferenceEngine';
import { NativeInferenceEngine, isNativeInferenceAvailable } from '../services/llmEngine/nativeInference';
import { LLMEngine, BaseLLMEngine } from '../services/llmEngine/LLMEngine';
import { ModelLoader } from '../services/llmEngine/modelLoader';
import * as llamaRNBridge from '../services/llmEngine/llamaRNBridge';
import { Message, Conversation } from '../types/chat';
import { Response } from '../types/common';
import { InferenceConfig } from '../types/models';
import {
  buildContextPrompt,
  buildToolCallingSystemPrompt,
  buildDirectInferenceSystemPrompt,
  TableSchema,
} from '../services/api/contextBuilder';
import { useSettingsStore } from '../store/settingsStore';
import { useModelStore } from '../store/modelStore';
import { tokenizerRegistry } from '../services/llmEngine/tokenizerRegistry';

const MODEL_LOAD_TIMEOUT_MS = 60_000; // 60 s — PTE can be slow to mmap

interface UseLLMEngineState {
  isReady: boolean;
  isGenerating: boolean;
  error: string | null;
  engine: LLMEngine | null;
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

      // Unload previous engine first
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

      try {
        // Validate the file exists and get format
        await ModelLoader.loadModel(modelPath);
        const modelFormat = ModelLoader.getModelFormat(modelPath);

        if (modelFormat === 'onnx') {
          throw new Error('ONNX inference is not yet supported.');
        }

        const config: InferenceConfig = {
          modelId: selectedModel?.id ?? modelPath.split('/').pop()?.replace(/\.[^.]+$/, '') ?? 'unknown',
          modelPath,
          tokenizerPath: selectedTokenizerPath ?? selectedModel?.tokenizerPath,
          temperature: selectedModel?.temperature ?? 0.7,
          maxTokens: selectedModel?.maxTokens ?? 512,
          contextWindow: selectedModel?.contextWindow ?? 2048,
          topK: 40,
          topP: 0.9,
          streamTokens: true,
        };

        // Choose the correct loading strategy
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error(`Model loading timed out after ${MODEL_LOAD_TIMEOUT_MS / 1000}s`)),
            MODEL_LOAD_TIMEOUT_MS
          )
        );

        if (modelFormat === 'pte') {
          // ── ExecuTorch PTE path ──────────────────────────────────────────
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
          await Promise.race([nativeEngine.initialize(config), timeoutPromise]);

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

        // ── GGUF path (llama.rn) ─────────────────────────────────────────
        await Promise.race([
          llamaRNBridge.loadModel(modelPath, {
            numThreads: 4,
            contextWindow: config.contextWindow,
          }),
          timeoutPromise,
        ]);

        if (initAbort.signal.aborted || !mounted) return;

        const engine: BaseLLMEngine =
          mode === 'tool_calling' ? new ToolCallingEngine() : new DirectInferenceEngine();

        await engine.initialize(config);

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
        if (initAbort.signal.aborted || !mounted) return;

        const msg = e instanceof Error ? e.message : 'Failed to initialize engine';
        console.error('[useLLMEngine] init error:', msg);

        // Reset engine state cleanly on failure
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
      // Wait for in-flight init if needed
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

      const fullPrompt = buildContextPrompt(userQuery, messages, conversationWithSystem, {
        includeSystemPrompt: true,
        maxContextMessages: 20,
        maxContextTokens: selectedModel?.contextWindow ? selectedModel.contextWindow - 512 : 2048,
      });
      const promptTokens = tokenizerRegistry.estimatePromptTokens(fullPrompt);

      // Cancel any previous generation
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      setState((prev) => ({ ...prev, isGenerating: true, error: null }));

      try {
        const runGeneration = () =>
          engineRef.current!.generate(
            fullPrompt,
            (event) => {
              if (event.type === 'token') onToken(event.content);
            },
            ctrl.signal
          );

        let response = await runGeneration();

        // Auto-reload llama.rn bridge if it was unloaded between requests
        if (!response.content && modelPath && ModelLoader.getModelFormat(modelPath) !== 'pte' && !llamaRNBridge.isLoaded()) {
          await llamaRNBridge.loadModel(modelPath, {
            numThreads: 4,
            contextWindow: selectedModel?.contextWindow ?? 2048,
          });
          response = await runGeneration();
        }

        if (response?.metrics) {
          response.metrics.promptTokens = promptTokens;
        }
        setState((prev) => ({ ...prev, isGenerating: false }));
        return response;
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Generation failed';

        // Attempt one reload for GGUF "model not loaded" transient errors
        const isGGUF = modelPath && ModelLoader.getModelFormat(modelPath) !== 'pte';
        if (
          isGGUF &&
          modelPath &&
          (message.includes('Model not loaded') || message.includes('not initialized'))
        ) {
          try {
            await llamaRNBridge.loadModel(modelPath, {
              numThreads: 4,
              contextWindow: selectedModel?.contextWindow ?? 2048,
            });
            const retryResponse = await engineRef.current!.generate(
              fullPrompt,
              (event) => {
                if (event.type === 'token') onToken(event.content);
              },
              ctrl.signal
            );
            if (retryResponse?.metrics) {
              retryResponse.metrics.promptTokens = promptTokens;
            }
            setState((prev) => ({ ...prev, isGenerating: false, error: null }));
            return retryResponse;
          } catch (retryError) {
            const retryMsg =
              retryError instanceof Error ? retryError.message : 'Generation failed';
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
