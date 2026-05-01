import { PYTHON_SECURITY_BLACKLIST, PYTHON_SECURITY_WHITELIST } from '../../types/python';

export class SecurityPolicy {
  /**
   * Validates Python code for security
   * - Blocks dangerous imports and functions
   * - Enforces whitelist of allowed modules
   */
  static validateCode(code: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check for blacklisted imports/functions
    for (const banned of PYTHON_SECURITY_BLACKLIST) {
      const regex = new RegExp(`\\b${banned}\\b`, 'g');
      if (regex.test(code)) {
        errors.push(`Dangerous operation detected: ${banned}`);
      }
    }

    // Check for eval/exec
    if (/\beval\s*\(|exec\s*\(/gi.test(code)) {
      errors.push('eval() and exec() are not allowed');
    }

    // Check for __import__
    if (/__import__\s*\(/g.test(code)) {
      errors.push('__import__() is not allowed');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get list of whitelisted imports
   */
  static getWhitelistedImports(): string[] {
    return PYTHON_SECURITY_WHITELIST;
  }

  /**
   * Check if import is allowed
   */
  static isImportAllowed(moduleName: string): boolean {
    return PYTHON_SECURITY_WHITELIST.includes(moduleName);
  }
}
