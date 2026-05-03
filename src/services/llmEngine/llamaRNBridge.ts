import { initLlama, LlamaContext } from 'llama.rn';

export interface LoadModelOptions {
  numThreads?: number;
  contextWindow?: number;
}

export interface GenerateParams {
  temperature?: number;
  maxTokens?: number;
  topK?: number;
  topP?: number;
  stop?: string[];
}

export interface GenerateResult {
  text: string;
  generationTimeMs: number;
  timeToFirstTokenMs: number;
  outputTokens: number;
  tokensPerSecond: number;
}

let _context: LlamaContext | null = null;
let _modelPath: string | null = null;

export async function loadModel(
  modelPath: string,
  options: LoadModelOptions = {}
): Promise<void> {
  const { numThreads = 4, contextWindow = 2048 } = options;

  if (_context && _modelPath === modelPath) return;

  await unloadModel();

  try {
    _context = await initLlama({
      model: modelPath,
      use_mlock: false,
      n_ctx: contextWindow,
      n_threads: numThreads,
      n_gpu_layers: 0,
    });
    _modelPath = modelPath;
  } catch (e) {
    _context = null;
    _modelPath = null;

    // Give a clear message when the native library isn't linked yet
    const msg = e instanceof Error ? e.message : String(e);
    const isNativeError =
      msg.includes('not installed') ||
      msg.includes('native module') ||
      msg.includes('null') ||
      msg.includes('JSI') ||
      msg.includes('installJsi') ||
      msg.includes('Cannot read');

    if (isNativeError) {
      throw new Error(
        'llama.rn native library is not linked. Run `npx react-native run-android` (full rebuild) to compile it.'
      );
    }
    throw e;
  }
}

export async function unloadModel(): Promise<void> {
  if (_context) {
    try {
      await _context.release();
    } catch {}
    _context = null;
    _modelPath = null;
  }
}

export function isLoaded(): boolean {
  return _context !== null;
}

export async function generate(
  prompt: string,
  params: GenerateParams,
  onToken: (token: string) => void,
  abortSignal?: AbortSignal
): Promise<GenerateResult> {
  if (!_context) throw new Error('Model not loaded');
  if (abortSignal?.aborted) throw new Error('Aborted before generation');

  const abortHandler = () => {
    _context?.stopCompletion().catch(() => {});
  };
  abortSignal?.addEventListener('abort', abortHandler);

  try {
    const result = await _context.completion(
      {
        prompt,
        n_predict: params.maxTokens ?? 1024,
        temperature: params.temperature ?? 0.7,
        top_k: params.topK ?? 40,
        top_p: params.topP ?? 0.9,
        stop: params.stop ?? ['</s>', '<|end|>', '<|im_end|>', '<end_of_turn>', '<eos>'],
      },
      (data: { token: string }) => {
        if (data.token) onToken(data.token);
      }
    );

    const t = result.timings;
    return {
      text: result.text,
      generationTimeMs: t?.predicted_ms ?? 0,
      timeToFirstTokenMs: t?.prompt_ms ?? 0,
      outputTokens: t?.predicted_n ?? 0,
      tokensPerSecond: t?.predicted_per_second ?? 0,
    };
  } finally {
    abortSignal?.removeEventListener('abort', abortHandler);
  }
}
