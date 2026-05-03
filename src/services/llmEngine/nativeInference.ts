import { NativeModules, NativeEventEmitter, Platform } from 'react-native';
import { BaseLLMEngine } from './LLMEngine';
import { Response, StreamEvent } from '../../types/common';
import { InferenceConfig } from '../../types/models';

const { LLMModule } = NativeModules;

/**
 * ExecuTorch PTE inference engine using the LLMModule native bridge.
 *
 * LLMModule native API (Android):
 *   loadModel(modelPath: string, tokenizerPath: string, temperature: float): Promise<boolean>
 *   generate(prompt: string, maxTokens: int): Promise<number>  // result code
 *   stopGeneration(): Promise<boolean>
 *   unloadModel(): Promise<boolean>
 *
 * Tokens are streamed via the "onToken" DeviceEventEmitter event: { token: string }
 * Model-loaded event: "onModelLoaded" { modelPath: string }
 */
export class NativeInferenceEngine extends BaseLLMEngine {
  private emitter: NativeEventEmitter | null = null;

  async initialize(config: InferenceConfig): Promise<void> {
    if (!LLMModule) {
      throw new Error(
        'LLMModule native module not available. ' +
          'Ensure the app is built with the ExecuTorch AAR on Android.'
      );
    }
    if (Platform.OS !== 'android') {
      throw new Error('PTE inference is only supported on Android.');
    }
    if (!config.modelPath) {
      throw new Error('modelPath is required for PTE inference.');
    }
    if (!config.tokenizerPath) {
      throw new Error(
        'tokenizerPath is required for PTE inference. ' +
          'Please select a tokenizer file (.bin or .model).'
      );
    }

    // Store config but keep isInitialized = false until the native load succeeds.
    // super.initialize() would flip isInitialized → true prematurely, so we
    // call it after the load succeeds to avoid isReady() returning true on a
    // partially-initialized engine.
    this.config = config;
    this.emitter = new NativeEventEmitter(LLMModule);

    const temperature = config.temperature ?? 0.8;

    let success: boolean;
    try {
      success = await LLMModule.loadModel(
        config.modelPath,
        config.tokenizerPath,
        temperature
      );
    } catch (e: any) {
      // Clean up emitter before re-throwing so there's no dangling listener
      this.emitter.removeAllListeners('onToken');
      this.emitter.removeAllListeners('onModelLoaded');
      this.emitter = null;
      const detail = e?.message ?? String(e);
      throw new Error(`PTE model load failed: ${detail}`);
    }

    if (!success) {
      this.emitter.removeAllListeners('onToken');
      this.emitter.removeAllListeners('onModelLoaded');
      this.emitter = null;
      throw new Error(`PTE model load failed (loadModel returned false).`);
    }

    // Native load confirmed — mark as ready
    this.isInitialized = true;
  }

  async generate(
    prompt: string,
    onStream: (event: StreamEvent) => void,
    abortSignal?: AbortSignal
  ): Promise<Response> {
    if (!this.isReady() || !LLMModule || !this.emitter) {
      throw new Error('NativeInferenceEngine: not initialized — call initialize() first.');
    }
    if (abortSignal?.aborted) {
      throw new Error('Aborted before generation started.');
    }

    let collected = '';

    const tokenSub = this.emitter.addListener('onToken', (data: { token?: string }) => {
      if (data?.token) {
        collected += data.token;
        onStream({ type: 'token', content: data.token, timestamp: Date.now() });
      }
    });

    const stopOnAbort = () => {
      LLMModule.stopGeneration().catch(() => undefined);
    };
    abortSignal?.addEventListener('abort', stopOnAbort);

    try {
      const maxTokens = this.config?.maxTokens ?? 512;
      const resultCode: number = await LLMModule.generate(prompt, maxTokens);

      if (resultCode !== 0) {
        throw new Error(`PTE generate() returned error code: ${resultCode}`);
      }

      return {
        type: 'direct_inference',
        content: collected,
      };
    } catch (e: any) {
      if (abortSignal?.aborted) {
        return { type: 'direct_inference', content: collected };
      }
      throw e;
    } finally {
      tokenSub.remove();
      abortSignal?.removeEventListener('abort', stopOnAbort);
    }
  }

  async unload(): Promise<void> {
    this.emitter?.removeAllListeners('onToken');
    this.emitter?.removeAllListeners('onModelLoaded');
    this.emitter = null;

    if (LLMModule) {
      try {
        await LLMModule.unloadModel();
      } catch (e) {
        // Best-effort unload
      }
    }

    await super.unload();
  }
}

export function isNativeInferenceAvailable(): boolean {
  return Platform.OS === 'android' && !!LLMModule;
}
