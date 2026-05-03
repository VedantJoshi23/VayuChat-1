import { pick, keepLocalCopy, errorCodes, isErrorWithCode } from '@react-native-documents/picker';
import RNFS from 'react-native-fs';

export type ModelExt = 'gguf' | 'pte' | 'onnx';
export type TokenizerExt = 'json' | 'bin' | 'model';
export type DatasetExt = 'csv' | 'json' | 'pkl';
export type SupportedExt = ModelExt | TokenizerExt | DatasetExt;

export interface PickedFile {
  path: string; // Local filesystem path (after keepLocalCopy)
  name: string;
  size: number;
  ext: SupportedExt;
}

const MODEL_EXTS: ModelExt[] = ['gguf', 'pte', 'onnx'];
const TOKENIZER_EXTS: TokenizerExt[] = ['json', 'bin', 'model'];
const DATASET_EXTS: DatasetExt[] = ['csv', 'json', 'pkl'];

function extOf(name: string | null | undefined): string | null {
  if (!name) return null;
  const m = name.toLowerCase().match(/\.([a-z0-9]+)$/);
  return m ? m[1] : null;
}

async function ensureModelsDir(): Promise<string> {
  const dir = `${RNFS.DocumentDirectoryPath}/models`;
  try {
    const exists = await RNFS.exists(dir);
    if (!exists) await RNFS.mkdir(dir);
  } catch {}
  return dir;
}

async function pickWithExtensions(
  allowedExts: readonly SupportedExt[],
  label: string
): Promise<PickedFile | null> {
  let result;
  try {
    result = await pick({
      type: ['*/*'],
      allowMultiSelection: false,
      copyTo: undefined,
    } as any);
  } catch (e: any) {
    if (isErrorWithCode(e) && e.code === errorCodes.OPERATION_CANCELED) {
      return null;
    }
    throw e;
  }

  if (!result || result.length === 0) return null;
  const picked = result[0];
  if (!picked.uri || !picked.name) {
    throw new Error(`${label}: invalid pick result`);
  }

  const ext = extOf(picked.name);
  if (!ext || !(allowedExts as readonly string[]).includes(ext)) {
    throw new Error(
      `${label}: unsupported extension ".${ext ?? '?'}". Expected: ${allowedExts.join(', ')}`
    );
  }

  // Materialize SAF/iCloud URI into a real filesystem path
  const dir = await ensureModelsDir();
  const copies = await keepLocalCopy({
    files: [{ uri: picked.uri, fileName: picked.name }],
    destination: 'documentDirectory',
  });
  const copy = copies[0];
  if (copy.status !== 'success') {
    throw new Error(`Failed to import ${picked.name}: ${copy.copyError ?? 'unknown error'}`);
  }

  // keepLocalCopy lands in DocumentDirectoryPath; move into models/ (or datasets/) subdir
  const finalPath = `${dir}/${picked.name}`;
  try {
    if (copy.localUri !== finalPath) {
      const exists = await RNFS.exists(finalPath);
      if (exists) await RNFS.unlink(finalPath);
      await RNFS.moveFile(copy.localUri.replace(/^file:\/\//, ''), finalPath);
    }
  } catch (e) {
    // If the move fails, fall back to the localUri path
    return {
      path: copy.localUri.replace(/^file:\/\//, ''),
      name: picked.name,
      size: picked.size ?? 0,
      ext: ext as SupportedExt,
    };
  }

  return {
    path: finalPath,
    name: picked.name,
    size: picked.size ?? 0,
    ext: ext as SupportedExt,
  };
}

async function ensureDatasetsDir(): Promise<string> {
  const dir = `${RNFS.DocumentDirectoryPath}/datasets`;
  try {
    const exists = await RNFS.exists(dir);
    if (!exists) await RNFS.mkdir(dir);
  } catch {}
  return dir;
}

export const filePicker = {
  pickModel: () => pickWithExtensions(MODEL_EXTS, 'Model'),
  pickTokenizer: () => pickWithExtensions(TOKENIZER_EXTS, 'Tokenizer'),
  pickDataset: () => pickWithExtensions(DATASET_EXTS, 'Dataset'),
  ensureModelsDir,
  ensureDatasetsDir,
};
