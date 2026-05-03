import { initLlama, LlamaContext } from 'llama.rn';
import type {
  RNLlamaOAICompatibleMessage,
  JinjaFormattedChatResult,
} from 'llama.rn';

export type { RNLlamaOAICompatibleMessage };

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
  const { numThreads = 6, contextWindow = 2048 } = options;

  if (_context && _modelPath === modelPath) return;

  await unloadModel();

  try {
    _context = await initLlama({
      model: modelPath,
      // Prevent the OS from swapping model pages mid-inference — this is the
      // primary cause of the multi-second first-token latency on memory-
      // constrained devices. With mlock the kernel keeps the mapped pages
      // resident so every prefill access is served from RAM.
      use_mlock: true,
      use_mmap: true,      // still mmap the file; mlock pins those pages
      n_ctx: contextWindow,
      n_threads: numThreads,
      // n_batch controls how many tokens are processed in one matrix multiply
      // during prefill.  512 matches llama.cpp's default and gives good
      // throughput without excessive memory pressure.
      n_batch: 512,
      n_ubatch: 512,
      n_gpu_layers: 0,
      // Gracefully handle prompts that exceed n_ctx by sliding the context
      // window instead of hard-erroring.
      ctx_shift: true,
    });
    _modelPath = modelPath;
  } catch (e) {
    _context = null;
    _modelPath = null;

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

// ── Raw completion (PTE fallback / internal use) ──────────────────────────────

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
        n_predict: params.maxTokens ?? 512,
        temperature: params.temperature ?? 0.7,
        top_k: params.topK ?? 40,
        top_p: params.topP ?? 0.9,
        stop: params.stop ?? DEFAULT_STOP_TOKENS,
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

// ── Chat-template completion ──────────────────────────────────────────────────

/**
 * Formats `messages` using the model's own embedded Jinja/llama-chat template
 * (read from the GGUF metadata), then runs completion.
 *
 * Using the model's template is critical for correctness: instruction-tuned
 * models are trained to expect a specific format (ChatML, Llama-3 eot_id,
 * Mistral [INST], Phi-3 <|end|>, …).  Sending a mismatched format causes the
 * model to immediately produce its EOS token → only 1 token is generated.
 *
 * The `JinjaFormattedChatResult` also returns `additional_stops` (stop tokens
 * that the template requires) which we merge with any caller-supplied stops.
 *
 * @throws if the model is not loaded
 */
export async function generateChat(
  messages: RNLlamaOAICompatibleMessage[],
  params: GenerateParams,
  onToken: (token: string) => void,
  abortSignal?: AbortSignal
): Promise<GenerateResult> {
  if (!_context) throw new Error('Model not loaded');
  if (abortSignal?.aborted) throw new Error('Aborted before generation');

  // Apply the model's chat template.  `jinja: true` uses the Jinja template
  // embedded in the GGUF; `add_generation_prompt: true` appends the
  // assistant-turn prefix so the model knows to continue as the assistant.
  const chatResult = await _context.getFormattedChat(messages, null, {
    jinja: true,
    add_generation_prompt: true,
    force_pure_content: true,  // don't try to parse tool-call syntax from history
  });

  const templateStops: string[] =
    'additional_stops' in chatResult
      ? ((chatResult as JinjaFormattedChatResult).additional_stops ?? [])
      : [];

  const mergedStop = [
    ...(params.stop ?? []),
    ...templateStops,
    // Keep a minimal set of universal EOS strings as a safety net in case the
    // model's template doesn't cover them.
    ...DEFAULT_STOP_TOKENS,
  ].filter((s, i, arr) => arr.indexOf(s) === i); // deduplicate

  return generate(chatResult.prompt, { ...params, stop: mergedStop }, onToken, abortSignal);
}

// Minimal universal fallback stop tokens.  These are only used when the
// model's own template doesn't supply additional_stops.
const DEFAULT_STOP_TOKENS = ['</s>', '<|end_of_text|>', '<|eot_id|>'];
