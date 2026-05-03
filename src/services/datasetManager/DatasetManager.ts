import RNFS from 'react-native-fs';
import { NativeModules } from 'react-native';
import { DatasetMetadata, DatasetFormat } from './types';
import { parseCSV, parseJSON, Row } from '../dataOperations/DataFrameManager';

const { PythonModule } = NativeModules;

/** File extensions the manager recognises and what format they map to */
const EXT_FORMAT_MAP: Record<string, DatasetFormat> = {
  pkl: 'pkl',
  csv: 'csv',
  json: 'json',
};

/** Derive the DatasetFormat from a filename, or null if unrecognised */
function formatFromFilename(filename: string): DatasetFormat | null {
  const match = filename.toLowerCase().match(/\.([a-z0-9]+)$/);
  const ext = match?.[1] ?? '';
  return EXT_FORMAT_MAP[ext] ?? null;
}

/**
 * Manages dataset loading and caching for all supported formats:
 *   • .pkl  — Pickle binary (loaded via Chaquopy/PythonModule on Android)
 *   • .csv  — Comma-separated values
 *   • .json — JSON array or { key: [...] } object
 */
export class DatasetManager {
  private loadedDatasets: Map<string, DatasetMetadata> = new Map();
  private datasetPaths: string[];

  constructor(datasetPaths?: string[]) {
    this.datasetPaths = datasetPaths ?? [
      `${RNFS.DocumentDirectoryPath}/datasets`,
      `${RNFS.CachesDirectoryPath}/datasets`,
      ...(RNFS.ExternalStorageDirectoryPath
        ? [`${RNFS.ExternalStorageDirectoryPath}/datasets`]
        : []),
    ];
  }

  async initialize(): Promise<void> {
    console.log('DatasetManager initialized');
  }

  // ── Discovery ────────────────────────────────────────────────────────────────

  /**
   * Scan all configured directories for .pkl, .csv, and .json files.
   * Returns a DatasetMetadata entry for every file found.
   */
  async getAvailableDatasets(): Promise<DatasetMetadata[]> {
    const datasets: DatasetMetadata[] = [];

    for (const basePath of this.datasetPaths) {
      try {
        const exists = await RNFS.exists(basePath);
        if (!exists) continue;

        const files = await RNFS.readdir(basePath);

        for (const file of files) {
          const format = formatFromFilename(file);
          if (!format) continue; // skip unrecognised extensions

          const fullPath = `${basePath}/${file}`;
          const stat = await RNFS.stat(fullPath);
          const extDotIndex = file.lastIndexOf('.');
          const name = extDotIndex > 0 ? file.slice(0, extDotIndex) : file;

          datasets.push({
            name,
            path: fullPath,
            size: stat.size,
            format,
            loadedAt: null,
          });
        }
      } catch (error) {
        console.warn(`DatasetManager: error scanning ${basePath}:`, error);
      }
    }

    return datasets;
  }

  // ── Loading ──────────────────────────────────────────────────────────────────

  /**
   * Validates the dataset name to block path-traversal attacks.
   */
  private validateName(name: string): void {
    if (!name || name.length > 255) {
      throw new Error('Dataset name must be 1–255 characters long');
    }
    if (name.includes('..') || name.includes('/') || name.includes('\\')) {
      throw new Error('Invalid dataset name: contains path traversal characters');
    }
  }

  /**
   * Load rows from a file using the appropriate parser.
   *
   * • pkl  → delegated to PythonModule.loadPickleAsJson (Android/Chaquopy)
   * • csv  → parseCSV (pure JS)
   * • json → parseJSON (pure JS)
   *
   * Returns the rows so callers can populate the DataFrameManager or compute
   * column/rowCount metadata without a second read.
   */
  async loadRows(path: string, format: DatasetFormat): Promise<Row[]> {
    switch (format) {
      case 'pkl': {
        if (!PythonModule?.loadPickleAsJson) {
          throw new Error(
            'PKL loading requires the Python native module (Android + Chaquopy). ' +
              'iOS is not supported for pickle files.'
          );
        }
        const jsonStr: string = await PythonModule.loadPickleAsJson(path);
        return JSON.parse(jsonStr) as Row[];
      }

      case 'csv': {
        const text = await RNFS.readFile(path, 'utf8');
        return parseCSV(text);
      }

      case 'json': {
        const text = await RNFS.readFile(path, 'utf8');
        return parseJSON(text);
      }

      default: {
        // TypeScript exhaustiveness guard
        const _exhaustive: never = format;
        throw new Error(`Unsupported dataset format: ${(_exhaustive as DatasetFormat)}`);
      }
    }
  }

  /**
   * Register and cache a dataset by name.
   *
   * On success the metadata is cached and the in-memory `columns` / `rowCount`
   * fields are populated so callers don't need to re-read the file.
   */
  async loadDataset(name: string): Promise<DatasetMetadata | null> {
    try {
      this.validateName(name);

      // Return from cache if already loaded
      if (this.loadedDatasets.has(name)) {
        return this.loadedDatasets.get(name)!;
      }

      // Discover the file
      const all = await this.getAvailableDatasets();
      const found = all.find((d) => d.name === name);
      if (!found) throw new Error(`Dataset '${name}' not found in any configured directory`);

      if (!(await RNFS.exists(found.path))) {
        throw new Error(`Dataset file missing on disk: ${found.path}`);
      }

      // Read rows to extract schema
      const rows = await this.loadRows(found.path, found.format);
      const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

      const meta: DatasetMetadata = {
        ...found,
        columns,
        rowCount: rows.length,
        loadedAt: new Date().toISOString(),
      };

      this.loadedDatasets.set(name, meta);
      console.log(
        `DatasetManager: loaded '${name}' (${found.format}) — ${rows.length} rows, ${columns.length} cols`
      );
      return meta;
    } catch (error) {
      console.error(`DatasetManager: failed to load '${name}':`, error);
      return null;
    }
  }

  // ── Python code generation ───────────────────────────────────────────────────

  /**
   * Returns a minimal Python snippet that loads the given dataset into a
   * pandas DataFrame, matching the format of the file.
   */
  getLoadingCode(datasetName: string, format: DatasetFormat = 'pkl'): string {
    switch (format) {
      case 'pkl':
        return [
          '# Load pickle dataset',
          'import pickle, pandas as pd',
          '',
          `with open('${datasetName}.pkl', 'rb') as f:`,
          '    df = pickle.load(f)',
          '',
          'print(f"Loaded {df.shape[0]} rows, {df.shape[1]} columns")',
          'print("Columns:", ", ".join(df.columns))',
        ].join('\n');

      case 'csv':
        return [
          '# Load CSV dataset',
          'import pandas as pd',
          '',
          `df = pd.read_csv('${datasetName}.csv')`,
          '',
          'print(f"Loaded {df.shape[0]} rows, {df.shape[1]} columns")',
          'print("Columns:", ", ".join(df.columns))',
        ].join('\n');

      case 'json':
        return [
          '# Load JSON dataset',
          'import pandas as pd',
          '',
          `df = pd.read_json('${datasetName}.json')`,
          '',
          'print(f"Loaded {df.shape[0]} rows, {df.shape[1]} columns")',
          'print("Columns:", ", ".join(df.columns))',
        ].join('\n');
    }
  }

  // ── Cache management ─────────────────────────────────────────────────────────

  clearCache(name: string): void {
    this.loadedDatasets.delete(name);
    console.log(`DatasetManager: cache cleared for '${name}'`);
  }

  clearAllCache(): void {
    this.loadedDatasets.clear();
    console.log('DatasetManager: all caches cleared');
  }

  getMetadata(name: string): DatasetMetadata | undefined {
    return this.loadedDatasets.get(name);
  }

  getAllMetadata(): DatasetMetadata[] {
    return Array.from(this.loadedDatasets.values());
  }

  destroy(): void {
    this.clearAllCache();
  }
}
