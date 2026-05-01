import { DocumentDirectoryPath } from 'react-native-fs';
import { ModelConfig } from '../../types/models';

/**
 * Scans Downloads directory for available models
 * Supports: .gguf, .pte, .onnx formats
 */
export class ModelLoader {
  static async scanDownloadsForModels(): Promise<ModelConfig[]> {
    // TODO: Implement actual file scanning using react-native-fs
    // For now, return empty array
    // Users will place models in: /sdcard/Downloads/ or equivalent
    return [];
  }

  static async loadModel(modelPath: string): Promise<void> {
    // TODO: Initialize GGML/ONNX/ExecuTorch based on format
    // This will involve native module bindings
    console.log(`Loading model from: ${modelPath}`);
  }

  static getModelFormat(
    path: string
  ): 'gguf' | 'pte' | 'onnx' | 'unknown' {
    if (path.endsWith('.gguf')) return 'gguf';
    if (path.endsWith('.pte')) return 'pte';
    if (path.endsWith('.onnx')) return 'onnx';
    return 'unknown';
  }

  static estimateContextWindow(format: string): number {
    // Default context windows for different model sizes
    return 2048;
  }
}
