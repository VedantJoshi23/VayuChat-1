import { ModelConfig } from '../../types/models';
import RNFS from 'react-native-fs';

export type ModelFormat = 'gguf' | 'pte' | 'onnx' | 'unknown';

/**
 * Scans Downloads directory for available models
 * Supports: .gguf, .pte, .onnx formats
 * Model location: /sdcard/Download/ or equivalent platform downloads folder
 */
export class ModelLoader {
  // Known locations for model files across Android versions
  private static readonly MODEL_LOCATIONS = [
    RNFS.DocumentDirectoryPath + '/models',
    RNFS.CachesDirectoryPath + '/models',
    RNFS.ExternalDirectoryPath + '/downloads',
    `${RNFS.ExternalStorageDirectoryPath}/Download`,
    `${RNFS.ExternalStorageDirectoryPath}/Downloads`,
  ];

  /**
   * Scan available locations for model files
   */
  static async scanDownloadsForModels(): Promise<ModelConfig[]> {
    const models: ModelConfig[] = [];

    for (const location of this.MODEL_LOCATIONS) {
      try {
        const exists = await RNFS.exists(location);
        if (!exists) continue;

        const files = await RNFS.readdir(location);

        for (const file of files) {
          const format = this.getModelFormat(file);
          if (format !== 'unknown') {
            const fullPath = `${location}/${file}`;
            const stat = await RNFS.stat(fullPath);

            // Only include readable files that are reasonably sized (> 50MB)
            if (stat.isFile() && stat.size > 50 * 1024 * 1024) {
              const modelName = file.replace(/\.[^.]+$/, ''); // Remove extension
              models.push({
                id: modelName,
                name: modelName,
                path: fullPath,
                format,
                size: stat.size,
                contextWindow: this.estimateContextWindow(format, stat.size),
                temperature: 0.7,
                maxTokens: 1024,
              });
            }
          }
        }
      } catch (error) {
        console.warn(`Error scanning ${location}:`, error);
      }
    }

    return models;
  }

  /**
   * Load and validate a model
   */
  static async loadModel(modelPath: string): Promise<void> {
    try {
      const exists = await RNFS.exists(modelPath);
      if (!exists) {
        throw new Error(`Model file not found: ${modelPath}`);
      }

      const stat = await RNFS.stat(modelPath);
      if (!stat.isFile) {
        throw new Error(`Path is not a file: ${modelPath}`);
      }

      if (stat.size === 0) {
        throw new Error(`Model file is empty: ${modelPath}`);
      }

      console.log(`Model validated: ${modelPath} (${stat.size} bytes)`);
    } catch (error) {
      throw new Error(`Failed to load model: ${error}`);
    }
  }

  /**
   * Determine model format from file extension
   */
  static getModelFormat(filename: string): ModelFormat {
    const lower = filename.toLowerCase();
    if (lower.endsWith('.gguf')) return 'gguf';
    if (lower.endsWith('.pte')) return 'pte';
    if (lower.endsWith('.onnx')) return 'onnx';
    return 'unknown';
  }

  /**
   * Estimate context window based on format and model size
   * Larger models typically support larger context windows
   */
  static estimateContextWindow(format: ModelFormat, sizeBytes: number): number {
    // Rough estimates based on format and size
    const sizeMB = sizeBytes / (1024 * 1024);

    switch (format) {
      case 'gguf': {
        // GGUF models typically support 2K-32K context
        if (sizeMB > 50000) return 32768; // 70B+ models
        if (sizeMB > 20000) return 16384; // 30-50B models
        if (sizeMB > 10000) return 8192; // 10-30B models
        if (sizeMB > 4000) return 4096; // 7B models
        return 2048; // Small models
      }
      case 'pte': {
        // ExecuTorch models - typically smaller
        return 4096;
      }
      case 'onnx': {
        // ONNX models - varies widely
        return 2048;
      }
      default:
        return 2048;
    }
  }

  /**
   * Get pretty name for model
   */
  static formatModelName(filename: string): string {
    return filename
      .replace(/\.[^.]+$/, '') // Remove extension
      .replace(/[-_]/g, ' ') // Replace dashes/underscores with spaces
      .replace(/\b\w/g, (c) => c.toUpperCase()); // Capitalize words
  }
}
