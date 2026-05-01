export interface PythonExecutionRequest {
  code: string;
  timeout: number; // ms
  isolateImports?: boolean;
  datasetPath?: string;
}

export interface PythonExecutionResponse {
  stdout: string;
  stderr: string;
  plots: PythonPlot[];
  success: boolean;
  error?: string;
  executionTime: number;
}

export interface PythonPlot {
  title: string;
  base64Image: string;
  format: 'png' | 'jpeg';
}

export const PYTHON_SECURITY_WHITELIST = [
  'pandas',
  'numpy',
  'matplotlib',
  'pickle',
  'json',
  'math',
  'statistics',
  'datetime',
  'collections',
  'itertools',
];

export const PYTHON_SECURITY_BLACKLIST = [
  'os',
  'sys',
  'subprocess',
  'eval',
  'exec',
  '__import__',
  'open',
];
