import { useEffect, useRef, useState } from 'react';
import { PythonExecutor } from '../services/pythonExecution/PythonExecutor';
import { DatasetManager } from '../services/datasetManager/DatasetManager';
import { PythonExecutionRequest, PythonExecutionResponse } from '../types/python';

interface UsePythonExecutionState {
  isReady: boolean;
  isExecuting: boolean;
  error: string | null;
}

export function usePythonExecution() {
  const [state, setState] = useState<UsePythonExecutionState>({
    isReady: false,
    isExecuting: false,
    error: null,
  });

  const executorRef = useRef<PythonExecutor | null>(null);
  const datasetManagerRef = useRef<DatasetManager | null>(null);

  // Initialize on mount
  useEffect(() => {
    let isMounted = true;

    async function initialize() {
      try {
        setState((prev) => ({ ...prev, error: null }));

        // Initialize Python executor
        const executor = new PythonExecutor(10000); // 10 second timeout
        await executor.initialize();

        // Initialize dataset manager
        const datasetManager = new DatasetManager();
        await datasetManager.initialize();

        if (isMounted) {
          executorRef.current = executor;
          datasetManagerRef.current = datasetManager;
          setState((prev) => ({
            ...prev,
            isReady: true,
          }));
          console.log('Python execution environment ready');
        }
      } catch (error) {
        if (isMounted) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error initializing Python';
          setState((prev) => ({
            ...prev,
            isReady: false,
            error: errorMessage,
          }));
          console.error('Failed to initialize Python execution:', errorMessage);
        }
      }
    }

    initialize();

    return () => {
      isMounted = false;
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (executorRef.current) {
        executorRef.current.destroy();
      }
      if (datasetManagerRef.current) {
        datasetManagerRef.current.destroy();
      }
    };
  }, []);

  /**
   * Execute Python code
   */
  async function execute(
    code: string,
    timeoutMs?: number
  ): Promise<PythonExecutionResponse> {
    if (!state.isReady || !executorRef.current) {
      throw new Error('Python execution environment not ready');
    }

    setState((prev) => ({ ...prev, isExecuting: true, error: null }));

    try {
      const request: PythonExecutionRequest = {
        code,
        timeout: timeoutMs || 10000,
      };

      const response = await executorRef.current.execute(request);

      if (!response.success) {
        setState((prev) => ({
          ...prev,
          isExecuting: false,
          error: response.error,
        }));
      } else {
        setState((prev) => ({ ...prev, isExecuting: false }));
      }

      return response;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Execution failed';
      setState((prev) => ({
        ...prev,
        isExecuting: false,
        error: errorMessage,
      }));
      throw error;
    }
  }

  /**
   * Get available datasets
   */
  async function getDatasets() {
    if (!datasetManagerRef.current) {
      return [];
    }

    try {
      return await datasetManagerRef.current.getAvailableDatasets();
    } catch (error) {
      console.error('Failed to get datasets:', error);
      return [];
    }
  }

  /**
   * Load a dataset
   */
  async function loadDataset(name: string) {
    if (!datasetManagerRef.current) {
      throw new Error('Dataset manager not available');
    }

    return datasetManagerRef.current.loadDataset(name);
  }

  return {
    ...state,
    execute,
    getDatasets,
    loadDataset,
    resetError: () => setState((prev) => ({ ...prev, error: null })),
  };
}
