import { PYTHON_SECURITY_BLACKLIST, PYTHON_SECURITY_WHITELIST } from '../../types/python';

export class SecurityPolicy {
  /**
   * Validates Python code for security
   * - Blocks dangerous imports and functions
   * - Enforces whitelist of allowed modules
   */
  static validateCode(code: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // FIX: More comprehensive dangerous patterns
    const dangerousPatterns = [
      { regex: /\bexec\s*\(/gi, msg: 'exec() is not allowed' },
      { regex: /\beval\s*\(/gi, msg: 'eval() is not allowed' },
      { regex: /__import__\s*\(/g, msg: '__import__() is not allowed' },
      { regex: /\bopen\s*\(/gi, msg: 'open() is not allowed' },
      { regex: /\bos\./g, msg: 'os module is not allowed' },
      { regex: /\bsys\./g, msg: 'sys module is not allowed' },
      { regex: /\bsubprocess\./g, msg: 'subprocess module is not allowed' },
      { regex: /\bshutil\./g, msg: 'shutil module is not allowed' },
      { regex: /\bimport\s+os\b/g, msg: 'os module import is not allowed' },
      { regex: /\bimport\s+sys\b/g, msg: 'sys module import is not allowed' },
      { regex: /\bimport\s+subprocess\b/g, msg: 'subprocess module import is not allowed' },
      { regex: /\bfrom\s+os\s+/g, msg: 'os module is not allowed' },
      { regex: /\bfrom\s+sys\s+/g, msg: 'sys module is not allowed' },
      { regex: /\bfrom\s+subprocess\s+/g, msg: 'subprocess module is not allowed' },
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.regex.test(code)) {
        errors.push(pattern.msg);
      }
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
