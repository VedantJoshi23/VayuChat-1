import { useEffect, useRef, useState, useCallback } from 'react';
import { ToolCallingEngine } from '../services/llmEngine/ToolCallingEngine';
import { DirectInferenceEngine } from '../services/llmEngine/DirectInferenceEngine';
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
  const mountedRef = useRef(true);  // FIX: Track mounted state for cleanup
  const mode = useSettingsStore((s) => s.mode);
  const { availableModels, selectedModelId, selectedTokenizerPath } = useModelStore();

  const selectedModel = availableModels.find((m) => m.id === selectedModelId);

  // Initialize / re-initialize engine when modelPath or mode changes
  useEffect(() => {
    let mounted = true;
    let currentAbort: AbortController | null = null;

    async function init() {
      // FIX: Abort previous initialization if still running
      if (abortRef.current) {
        abortRef.current.abort();
      }

      currentAbort = new AbortController();
      abortRef.current = currentAbort;

      if (!modelPath) {
        setState((prev) => ({ ...prev, isReady: false, error: null }));
        return;
      }

      try {
        setState((prev) => ({ ...prev, isReady: false, error: null }));

        // Validate model file exists
        await ModelLoader.loadModel(modelPath);
        const modelFormat = ModelLoader.getModelFormat(modelPath);

        if (modelFormat === 'pte') {
          throw new Error(
            'ExecuTorch (.pte) inference is not implemented in the current native backend yet.'
          );
        }

        if (modelFormat === 'onnx') {
          throw new Error(
            'ONNX inference is not implemented in the current native backend yet.'
          );
        }

        // FIX: Add timeout for model loading
        const loadPromise = llamaRNBridge.loadModel(modelPath, {
          numThreads: 4,
          contextWindow: selectedModel?.contextWindow ?? 2048,
        });

        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Model loading timeout (30s)')), 30000);
        });

        await Promise.race([loadPromise, timeoutPromise]);

        // Check if aborted after long operation
        if (currentAbort?.signal.aborted) {
          return;
        }

        const config: InferenceConfig = {
          modelId: selectedModel?.id ?? modelPath.split('/').pop()?.replace(/\.[^.]+$/, '') ?? 'unknown',
          modelPath,
          tokenizerPath: selectedTokenizerPath ?? selectedModel?.tokenizerPath,
          temperature: selectedModel?.temperature ?? 0.7,
          maxTokens: selectedModel?.maxTokens ?? 1024,
          contextWindow: selectedModel?.contextWindow ?? 2048,
          topK: 40,
          topP: 0.9,
          streamTokens: true,
        };

        const engine: BaseLLMEngine =
          mode === 'tool_calling' ? new ToolCallingEngine() : new DirectInferenceEngine();

        await engine.initialize(config);

        // FIX: Check abort status before updating state
        if (!mounted || currentAbort?.signal.aborted) {
          await engine.unload();
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
        if (!mounted || currentAbort?.signal.aborted) return;
        const msg = e instanceof Error ? e.message : 'Failed to initialize engine';
        setState((prev) => ({ ...prev, isReady: false, error: msg }));
      } finally {
        initPromiseRef.current = null;
      }
    }

    // Abort any in-flight generation before re-init
    abortRef.current?.abort();
    abortRef.current = null;

    // Unload previous engine
    const prev = engineRef.current;
    engineRef.current = null;
    if (prev) {
      prev.unload().catch(() => undefined);
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
        throw new Error(state.error || 'Engine not ready');
      }

      // Always build a fresh system prompt so dataset schemas are current
      const systemPrompt =
        mode === 'tool_calling'
          ? buildToolCallingSystemPrompt(tableSchemas ?? [])
          : buildDirectInferenceSystemPrompt();

      const conversationWithSystem: Conversation = {
        ...conversation,
        systemPrompt,
      };

      const fullPrompt = buildContextPrompt(userQuery, messages, conversationWithSystem, {
        includeSystemPrompt: true,
        maxContextMessages: 20,
        maxContextTokens: selectedModel?.contextWindow ? selectedModel.contextWindow - 512 : 2048,
      });
      const promptTokens = tokenizerRegistry.estimatePromptTokens(fullPrompt);

      // Set up abort controller for this generation
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

        if (!response.content && modelPath && !llamaRNBridge.isLoaded()) {
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
        const shouldRetryReload =
          modelPath &&
          (message.includes('Model not loaded') || message.includes('not initialized'));

        if (shouldRetryReload) {
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
            const retryMessage =
              retryError instanceof Error ? retryError.message : 'Generation failed';
            setState((prev) => ({ ...prev, isGenerating: false, error: retryMessage }));
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
  }, []);

  const retryLoad = useCallback(() => {
    setState((prev) => ({ ...prev, error: null, isReady: false }));
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
