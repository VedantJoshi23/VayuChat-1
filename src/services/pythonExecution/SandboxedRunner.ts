import { PythonExecutionRequest, PythonExecutionResponse } from '../../types/python';
import { SecurityPolicy } from './securityPolicy';

/**
 * Executes Python code in a sandboxed environment with:
 * - Security validation
 * - Timeout enforcement
 * - Output capture (stdout/stderr)
 * - Plot capture
 */
export class SandboxedRunner {
  private timeout: number;
  private readonly MAX_TIMEOUT = 30000; // 30 seconds max

  constructor(timeoutMs: number = 10000) {
    this.timeout = Math.min(Math.max(timeoutMs, 1000), this.MAX_TIMEOUT);
  }

  /**
   * Run Python code with security checks and timeout
   */
  async run(request: PythonExecutionRequest): Promise<PythonExecutionResponse> {
    const startTime = Date.now();

    // 1. Validate code security
    const validation = SecurityPolicy.validateCode(request.code);
    if (!validation.valid) {
      return {
        stdout: '',
        stderr: validation.errors.join('\n'),
        plots: [],
        success: false,
        error: 'Code validation failed',
        executionTime: Date.now() - startTime,
      };
    }

    // 2. Inject safety wrappers
    const wrappedCode = this.injectSafetyWrappers(request.code);

    // 3. Execute with timeout
    try {
      const result = await this.executeWithTimeout(
        wrappedCode,
        request.timeout || this.timeout
      );

      return {
        stdout: result.stdout,
        stderr: result.stderr,
        plots: result.plots,
        success: result.stderr === '',
        error: result.stderr || null,
        executionTime: Date.now() - startTime,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      return {
        stdout: '',
        stderr: errorMsg,
        plots: [],
        success: false,
        error: errorMsg,
        executionTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Wrap code with safety features (import restrictions, timeout handler, etc.)
   */
  private injectSafetyWrappers(code: string): string {
    const wrapper = `
import sys
import io
import contextlib

# Capture stdout/stderr
stdout_capture = io.StringIO()
stderr_capture = io.StringIO()

# Store original modules to prevent reload attacks
SAFE_MODULES = {'pandas', 'numpy', 'matplotlib', 'pickle', 'json', 'math', 'statistics', 'datetime', 'collections', 'itertools'}

# Custom import hook for security
_orig_import = __builtins__.__import__

def safe_import(name, *args, **kwargs):
    if name not in SAFE_MODULES and not any(name.startswith(safe + '.') for safe in SAFE_MODULES):
        raise ImportError(f"Module '{name}' is not allowed")
    return _orig_import(name, *args, **kwargs)

__builtins__.__import__ = safe_import

# Execute user code
try:
    with contextlib.redirect_stdout(stdout_capture), contextlib.redirect_stderr(stderr_capture):
${code
  .split('\n')
  .map((line) => '    ' + line)
  .join('\n')}
except Exception as e:
    print(f"Error: {type(e).__name__}: {str(e)}", file=sys.stderr)
finally:
    # Restore original import
    __builtins__.__import__ = _orig_import

# Print captured output
print(stdout_capture.getvalue(), end='')
print(stderr_capture.getvalue(), file=sys.stderr, end='')
`;

    return wrapper;
  }

  /**
   * Execute code with timeout protection
   */
  private async executeWithTimeout(
    code: string,
    timeoutMs: number
  ): Promise<{ stdout: string; stderr: string; plots: any[] }> {
    // Create a timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Python execution timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    // Create the execution promise
    const executionPromise = this.executeCode(code);

    // Race between execution and timeout
    return Promise.race([executionPromise, timeoutPromise]);
  }

  /**
   * Execute the actual Python code
   * This will be called via the PythonModule native module
   */
  private async executeCode(code: string): Promise<{
    stdout: string;
    stderr: string;
    plots: any[];
  }> {
    // TODO: Call PythonModule.executePython(code) via NativeModules
    // For now, return mock response

    return {
      stdout: 'Code executed successfully',
      stderr: '',
      plots: [],
    };
  }

  /**
   * Get timeout duration
   */
  getTimeout(): number {
    return this.timeout;
  }

  /**
   * Set timeout duration
   */
  setTimeout(ms: number): void {
    this.timeout = Math.min(Math.max(ms, 1000), this.MAX_TIMEOUT);
  }

  /**
   * Check if a Python library is whitelisted
   */
  isLibraryAllowed(libName: string): boolean {
    return SecurityPolicy.isImportAllowed(libName);
  }

  /**
   * Get list of allowed libraries
   */
  getAllowedLibraries(): string[] {
    return SecurityPolicy.getWhitelistedImports();
  }
}
