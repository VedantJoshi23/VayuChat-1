import { PythonExecutionRequest, PythonExecutionResponse, PythonPlot } from '../../types/python';
import { SecurityPolicy } from './securityPolicy';

/**
 * Wrapper for Python execution on Android via Chaquopy
 * Will be extended with native module bindings
 */
export class PythonExecutor {
  private timeout: number = 10000; // 10 seconds
  private isInitialized = false;

  async initialize(): Promise<void> {
    // TODO: Initialize Chaquopy
    // Check if Chaquopy is available via native module
    this.isInitialized = true;
  }

  async execute(
    request: PythonExecutionRequest
  ): Promise<PythonExecutionResponse> {
    if (!this.isInitialized) {
      throw new Error('PythonExecutor not initialized');
    }

    // Validate code before execution
    const validation = SecurityPolicy.validateCode(request.code);
    if (!validation.valid) {
      return {
        stdout: '',
        stderr: validation.errors.join('\n'),
        plots: [],
        success: false,
        error: 'Code validation failed',
        executionTime: 0,
      };
    }

    try {
      // TODO: Call actual Chaquopy execution
      // For now, mock implementation
      const startTime = Date.now();

      const result = await this.mockExecute(request.code);

      const executionTime = Date.now() - startTime;

      return {
        stdout: result.stdout,
        stderr: result.stderr,
        plots: result.plots,
        success: result.stderr === '',
        error: result.stderr || null,
        executionTime,
      };
    } catch (error) {
      return {
        stdout: '',
        stderr: (error as Error).message,
        plots: [],
        success: false,
        error: (error as Error).message,
        executionTime: 0,
      };
    }
  }

  /**
   * Mock execution for testing
   * TODO: Replace with actual Chaquopy integration
   */
  private async mockExecute(
    code: string
  ): Promise<{ stdout: string; stderr: string; plots: PythonPlot[] }> {
    return {
      stdout: 'Code executed (mock)',
      stderr: '',
      plots: [],
    };
  }

  isReady(): boolean {
    return this.isInitialized;
  }

  destroy(): void {
    this.isInitialized = false;
  }
}
