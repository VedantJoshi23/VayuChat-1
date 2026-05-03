import { useCallback, useEffect, useRef, useState } from 'react';
import { useLLMEngine } from './useLLMEngine';
import { usePythonExecution } from './usePythonExecution';
import { CodeExecutor } from '../services/codeExecution/CodeExecutor';
import { Message, Conversation } from '../types/chat';
import { MessageRepository } from '../database/messageRepository';
import { ExecutionLog, PythonExecutionResponse } from '../types/python';

interface ChatState {
  isProcessing: boolean;
  isExecuting: boolean;
  currentResponse: string;
  streamingTokens: string[];
  executionLogs: Array<ExecutionLog | PythonExecutionResponse>;
  error: string | null;
}

export function useChat(modelPath: string, conversation: Conversation | null) {
  const [state, setState] = useState<ChatState>({
    isProcessing: false,
    isExecuting: false,
    currentResponse: '',
    streamingTokens: [],
    executionLogs: [],
    error: null,
  });

  const llmEngine = useLLMEngine(modelPath);
  const pythonExecution = usePythonExecution();
  const codeExecutorRef = useRef<CodeExecutor | null>(null);
  const msgRepoRef = useRef(new MessageRepository());

  // Initialize code executor
  useEffect(() => {
    let isMounted = true;
    
    const initExecutor = async () => {
      try {
        const executor = new CodeExecutor();
        await executor.initialize();
        
        if (isMounted) {
          codeExecutorRef.current = executor;
        }
      } catch (e) {
        console.error('CodeExecutor initialization failed:', e);
        if (isMounted) {
          setState(prev => ({ ...prev, error: String(e) }));
        }
      }
    };
    
    initExecutor();

    return () => {
      isMounted = false;
    };
  }, []);

  const processMessage = useCallback(
    async (userQuery: string, messages: Message[]) => {
      // Verify all dependencies are available
      if (!conversation) {
        setState((prev) => ({
          ...prev,
          error: 'No conversation selected',
        }));
        return;
      }

      if (!llmEngine.isReady) {
        setState((prev) => ({
          ...prev,
          error: 'LLM Engine not ready',
        }));
        return;
      }

      setState((prev) => ({
        ...prev,
        isProcessing: true,
        currentResponse: '',
        streamingTokens: [],
        error: null,
      }));

      try {
        // Step 1: Generate response from LLM
        const response = await llmEngine.generate(
          userQuery,
          conversation,
          messages,
          (token: string) => {
            setState((prev) => ({
              ...prev,
              currentResponse: prev.currentResponse + token,
              streamingTokens: [...prev.streamingTokens, token],
            }));
          }
        );

        if (!response) {
          throw new Error('No response from LLM');
        }

        // Step 2: Save assistant message
        const assistantMsg = await msgRepoRef.current.createMessage(
          conversation.id,
          'assistant',
          response.content
        );

        // Step 3: Process tool calls or execute code
        if (response.type === 'tool_calling' && response.toolCalls?.length) {
          setState((prev) => ({ ...prev, isExecuting: true }));

          const executionLogs: Array<ExecutionLog | PythonExecutionResponse> = [];
          for (const toolCall of response.toolCalls) {
            try {
              if (codeExecutorRef.current) {
                const result = await codeExecutorRef.current.executeToolCall(
                  toolCall.name,
                  toolCall.arguments
                );
                executionLogs.push(result);

                // Update tool call status
                if (result.success) {
                  toolCall.status = 'completed';
                  toolCall.result = result.stdout;
                  toolCall.metadata = result.plots?.length > 0 ? { plots: result.plots } : undefined;
                } else {
                  toolCall.status = 'failed';
                  toolCall.error = result.stderr;
                }
              }
            } catch (error) {
              const errorMsg = error instanceof Error ? error.message : 'Unknown error';
              toolCall.status = 'failed';
              toolCall.error = errorMsg;
              executionLogs.push({
                toolName: toolCall.name,
                args: toolCall.arguments,
                success: false,
                stderr: errorMsg,
                stdout: '',
                executionTime: 0,
                plots: [],
              });
            }
          }

          setState((prev) => ({
            ...prev,
            isExecuting: false,
            executionLogs,
          }));
        } else if (response.type === 'direct_inference' && response.code) {
          // Step 4: Execute generated Python code
          setState((prev) => ({ ...prev, isExecuting: true }));

          try {
            if (pythonExecution.execute) {
              const result = await pythonExecution.execute(response.code);

              setState((prev) => ({
                ...prev,
                executionLogs: [result],
                isExecuting: false,
              }));
            }
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Execution failed';
            setState((prev) => ({
              ...prev,
              isExecuting: false,
              error: `Execution error: ${errorMsg}`,
            }));
          }
        }

        setState((prev) => ({ ...prev, isProcessing: false }));
        return assistantMsg;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        setState((prev) => ({
          ...prev,
          isProcessing: false,
          isExecuting: false,
          error: errorMsg,
        }));
        throw error;
      }
    },
    [conversation, llmEngine, pythonExecution]
  );

  return {
    ...state,
    processMessage,
    llmReady: llmEngine.isReady,
    llmError: llmEngine.error,
  };
}
