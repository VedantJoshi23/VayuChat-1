/**
 * Validate if string is empty or whitespace
 */
export function isEmptyString(str: string | undefined | null): boolean {
  return !str || str.trim().length === 0;
}

/**
 * Validate model configuration
 */
export function isValidModelPath(path: string): boolean {
  const validExtensions = ['.gguf', '.pte', '.onnx'];
  return validExtensions.some((ext) => path.endsWith(ext));
}

/**
 * Validate inference config
 */
export function isValidInferenceConfig(config: any): boolean {
  return (
    config &&
    config.modelId &&
    typeof config.temperature === 'number' &&
    config.temperature >= 0 &&
    config.temperature <= 2 &&
    typeof config.maxTokens === 'number' &&
    config.maxTokens > 0
  );
}

/**
 * Validate Python code syntax (basic)
 */
export function hasBasicPythonSyntax(code: string): boolean {
  // Check for balanced brackets/parens
  const brackets = { '[': ']', '(': ')', '{': '}' };
  const stack: string[] = [];

  for (const char of code) {
    if (char in brackets) {
      stack.push(char);
    } else if (Object.values(brackets).includes(char)) {
      const last = stack.pop();
      if (!last || brackets[last as keyof typeof brackets] !== char) {
        return false;
      }
    }
  }

  return stack.length === 0;
}

/**
 * Validate dataset name
 */
export function isValidDatasetName(name: string): boolean {
  // Must be alphanumeric with underscores, 3-50 chars
  return /^[a-zA-Z0-9_]{3,50}$/.test(name);
}
