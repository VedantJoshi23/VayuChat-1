import { NativeModules, NativeEventEmitter } from 'react-native';
import { BaseLLMEngine } from './LLMEngine';
import { Response, StreamEvent } from '../../types/common';
import { InferenceConfig } from '../../types/models';

const { LLMModule } = NativeModules;

/**
 * Generic native inference engine — useful for raw text generation
 * without tool/code post-processing. Loads/unloads native model directly.
 */
export class NativeInferenceEngine extends BaseLLMEngine {
  private emitter: NativeEventEmitter | null = null;
  private modelPath: string;

  constructor(modelPath: string) {
    super();
    this.modelPath = modelPath;
  }

  async initialize(config: InferenceConfig): Promise<void> {
    await super.initialize(config);

    if (!LLMModule) {
      throw new Error('LLMModule native module not available');
    }
    this.emitter = new NativeEventEmitter(LLMModule);

    const numThreads = 4;
    const success = await LLMModule.loadModel(this.modelPath, numThreads);
    if (!success) {
      this.isInitialized = false;
      throw new Error(`Failed to load model from ${this.modelPath}`);
    }
  }

  async generate(
    prompt: string,
    onStream: (event: StreamEvent) => void,
    abortSignal?: AbortSignal
  ): Promise<Response> {
    if (!this.isReady() || !LLMModule || !this.emitter) {
      throw new Error('NativeInferenceEngine not initialized');
    }
    if (abortSignal?.aborted) {
      throw new Error('Aborted before generation');
    }

    let collected = '';
    const tokenSub = this.emitter.addListener('onToken', (data: { token?: string }) => {
      if (data?.token) {
        collected += data.token;
        onStream({ type: 'token', content: data.token, timestamp: Date.now() });
      }
    });

    const abortHandler = () => {
      try {
        LLMModule.cancelGenerate?.();
      } catch {}
    };
    abortSignal?.addEventListener('abort', abortHandler);

    try {
      const result: string = await LLMModule.generate(
        prompt,
        this.config?.temperature ?? 0.7,
        this.config?.maxTokens ?? 1024,
        this.config?.topK ?? 40,
        this.config?.topP ?? 0.9
      );
      if (!collected && result) {
        collected = result;
        onStream({ type: 'token', content: result, timestamp: Date.now() });
      }
      return { type: 'direct_inference', content: collected };
    } finally {
      tokenSub.remove();
      abortSignal?.removeEventListener('abort', abortHandler);
    }
  }

  async unload(): Promise<void> {
    if (LLMModule) {
      try {
        await LLMModule.unloadModel();
      } catch {}
    }
    this.emitter?.removeAllListeners('onToken');
    await super.unload();
  }
}

export function isNativeInferenceAvailable(): boolean {
  return LLMModule !== undefined;
}
