/**
 * Format number with locale-specific formatting
 */
export function formatNumber(value: number, decimals = 2): string {
  return parseFloat(value.toFixed(decimals)).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Format date/timestamp
 */
export function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString('en-US');
}

/**
 * Format relative time (e.g., "2 minutes ago")
 */
export function formatRelativeTime(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

/**
 * Format file size
 */
export function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

/**
 * Format execution time
 */
export function formatExecutionTime(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

/**
 * Truncate text with ellipsis
 */
export function truncateText(text: string, maxLength = 100): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}
