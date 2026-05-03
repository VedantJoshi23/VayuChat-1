import { NativeModules } from 'react-native';
import { PythonExecutionRequest, PythonExecutionResponse } from '../../types/python';
import { SandboxedRunner } from './SandboxedRunner';

const { PythonModule } = NativeModules;

/**
 * Wrapper for Python execution on Android via Chaquopy
 * Uses SandboxedRunner for security and timeout management
 */
export class PythonExecutor {
  private timeout: number = 10000; // 10 seconds
  private isInitialized = false;
  private runner: SandboxedRunner;

  constructor(timeoutMs: number = 10000) {
    this.timeout = timeoutMs;
    this.runner = new SandboxedRunner(timeoutMs);
  }

  async initialize(): Promise<void> {
    if (!PythonModule) {
      throw new Error('PythonModule native module not available');
    }

    // Chaquopy is initialized automatically by Android
    // This method is just for completeness
    this.isInitialized = true;
    console.log('PythonExecutor initialized');
  }

  /**
   * Execute Python code with security validation and timeout
   */
  async execute(
    request: PythonExecutionRequest
  ): Promise<PythonExecutionResponse> {
    if (!this.isInitialized) {
      throw new Error('PythonExecutor not initialized');
    }

    try {
      // Use SandboxedRunner for validation, safety wrapping, and timeout
      const result = await this.runner.run(request);

      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      return {
        stdout: '',
        stderr: errorMsg,
        plots: [],
        success: false,
        error: errorMsg,
        executionTime: 0,
      };
    }
  }

  /**
   * Execute and stream results (when Chaquopy fully integrated)
   */
  async executeWithCallback(
    code: string,
    onStdout?: (line: string) => void,
    onStderr?: (line: string) => void
  ): Promise<PythonExecutionResponse> {
    const request: PythonExecutionRequest = {
      code,
      timeout: this.timeout,
    };

    return this.execute(request);
  }

  /**
   * Check if Python module is available
   */
  isReady(): boolean {
    return this.isInitialized && PythonModule !== undefined;
  }

  /**
   * Get current timeout
   */
  getTimeout(): number {
    return this.timeout;
  }

  /**
   * Set execution timeout
   */
  setTimeout(ms: number): void {
    this.timeout = ms;
    this.runner.setTimeout(ms);
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.isInitialized = false;
  }
}
