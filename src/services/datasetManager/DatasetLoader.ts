/**
 * DatasetLoader — large-file-safe dataset loading service.
 *
 * Strategy by format:
 *   pkl  → Python (pandas) always, chunked in CHUNK_SIZE-row slices
 *   csv  → Python (pandas) for files ≥ LARGE_THRESHOLD, JS parseCSV otherwise
 *   json → JS JSON.parse always (already JSON on disk, native parse is fast)
 *
 * Chunking keeps each JSON.parse() call under ~1 MB so the JS thread is only
 * blocked for ~5 ms per chunk instead of potentially several seconds for a
 * single 50–200 MB payload.  A setTimeout(0) yield between chunks lets React
 * process pending renders and touch events.
 */
import { NativeModules } from 'react-native';
import RNFS from 'react-native-fs';
import { parseCSV, parseJSON, Row } from '../dataOperations/DataFrameManager';

const { PythonModule } = NativeModules;

/** Rows per native bridge call.  5 000 rows ≈ 500 KB–1 MB JSON — safe chunk. */
const CHUNK_SIZE = 5_000;

/** Files larger than this go through Python even for CSV. */
const LARGE_THRESHOLD_BYTES = 4 * 1024 * 1024; // 4 MB

export interface DatasetMeta {
  columns: string[];
  rowCount: number;
}

export interface LoadProgress {
  rowsLoaded: number;
  totalRows: number;
  phase: 'metadata' | 'loading' | 'done';
}

/**
 * Fetch only column names and row count for a dataset.
 * Never serialises row data — safe to call on any file size.
 * Used by DatasetPickerModal for fast preview.
 */
export async function getDatasetMeta(
  path: string,
  format: 'csv' | 'json' | 'pkl'
): Promise<DatasetMeta> {
  if (format === 'json') {
    // JSON: fast metadata via JS (no Python needed)
    const text = await RNFS.readFile(path, 'utf8');
    const rows = parseJSON(text);
    return {
      columns: rows.length > 0 ? Object.keys(rows[0]) : [],
      rowCount: rows.length,
    };
  }

  if (!PythonModule?.getDatasetMetadata) {
    // Python unavailable — fall back to full JS parse (slow but functional)
    const text = await RNFS.readFile(path, 'utf8');
    const rows = format === 'csv' ? parseCSV(text) : [];
    return {
      columns: rows.length > 0 ? Object.keys(rows[0]) : [],
      rowCount: rows.length,
    };
  }

  const metaStr: string = await PythonModule.getDatasetMetadata(path, format);
  return JSON.parse(metaStr) as DatasetMeta;
}

/**
 * Load all rows from a dataset file, using chunked native calls for large
 * files to keep the JS thread responsive throughout.
 *
 * @param onProgress  Optional callback fired after each chunk is appended.
 */
export async function loadDatasetRows(
  path: string,
  format: 'csv' | 'json' | 'pkl',
  sizeBytes: number,
  onProgress?: (p: LoadProgress) => void
): Promise<Row[]> {

  // ── JSON: small files, native JSON.parse is fast ────────────────────────────
  if (format === 'json') {
    const text = await RNFS.readFile(path, 'utf8');
    const rows = parseJSON(text);
    onProgress?.({ rowsLoaded: rows.length, totalRows: rows.length, phase: 'done' });
    return rows;
  }

  // ── Small CSV without Python: JS parse (only for very small files) ──────────
  if (format === 'csv' && sizeBytes < LARGE_THRESHOLD_BYTES && !PythonModule?.getDatasetMetadata) {
    const text = await RNFS.readFile(path, 'utf8');
    const rows = parseCSV(text);
    onProgress?.({ rowsLoaded: rows.length, totalRows: rows.length, phase: 'done' });
    return rows;
  }

  // ── PKL / large CSV: chunked Python loading ─────────────────────────────────
  if (!PythonModule?.getDatasetMetadata || !PythonModule?.loadDatasetChunk) {
    throw new Error(
      `${format.toUpperCase()} loading requires the Android Chaquopy module. ` +
        'Rebuild the app with Chaquopy enabled.'
    );
  }

  // Step 1: metadata (fast — no row serialisation)
  onProgress?.({ rowsLoaded: 0, totalRows: 0, phase: 'metadata' });
  const metaStr: string = await PythonModule.getDatasetMetadata(path, format);
  const { rowCount } = JSON.parse(metaStr) as DatasetMeta;

  if (rowCount === 0) {
    onProgress?.({ rowsLoaded: 0, totalRows: 0, phase: 'done' });
    return [];
  }

  // Step 2: load in chunks, yielding to the event loop between each
  const allRows: Row[] = [];
  allRows.length = rowCount; // pre-allocate to avoid repeated array resizing
  let filled = 0;

  onProgress?.({ rowsLoaded: 0, totalRows: rowCount, phase: 'loading' });

  let offset = 0;
  while (offset < rowCount) {
    const chunkStr: string = await PythonModule.loadDatasetChunk(
      path,
      format,
      offset,
      CHUNK_SIZE
    );
    const chunk: Row[] = JSON.parse(chunkStr);

    // Write chunk into pre-allocated array
    for (let i = 0; i < chunk.length; i++) {
      allRows[filled + i] = chunk[i];
    }
    filled += chunk.length;
    offset += chunk.length;

    onProgress?.({ rowsLoaded: filled, totalRows: rowCount, phase: 'loading' });

    // Yield to the JS event loop so React can process renders and touch events.
    // Without this, even chunked loading would freeze the UI between chunks.
    if (offset < rowCount) {
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
  }

  // Trim to actual size (last chunk may have been smaller than CHUNK_SIZE)
  allRows.length = filled;

  onProgress?.({ rowsLoaded: filled, totalRows: rowCount, phase: 'done' });
  return allRows;
}
