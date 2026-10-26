/**
 * Timestamp formatting and relative duration utilities for JWT claims and date analysis.
 */

export interface FormattedTimestamp {
  raw: number;
  utcString: string;
  isoString: string;
  localString: string;
  relative: string;
  isPast: boolean;
  diffSeconds: number;
}

/**
 * Checks if a value is a valid numeric Unix timestamp (in seconds or milliseconds).
 * Handles standard JWT second-based epoch timestamps.
 */
export function formatUnixTimestamp(timestamp: number | unknown): FormattedTimestamp | null {
  if (typeof timestamp !== 'number' || isNaN(timestamp) || !isFinite(timestamp)) {
    return null;
  }

  // Detect if timestamp is in seconds or milliseconds
  // Timestamps in seconds around current epoch are ~1.7e9, milliseconds ~1.7e12
  const inMilliseconds = timestamp > 1e11 ? timestamp : timestamp * 1000;
  const date = new Date(inMilliseconds);

  if (isNaN(date.getTime())) {
    return null;
  }

  const now = Date.now();
  const diffMs = inMilliseconds - now;
  const diffSeconds = Math.round(diffMs / 1000);
  const isPast = diffSeconds < 0;

  return {
    raw: timestamp,
    utcString: date.toUTCString(),
    isoString: date.toISOString(),
    localString: date.toLocaleString(),
    relative: formatRelativeDuration(Math.abs(diffSeconds), isPast),
    isPast,
    diffSeconds
  };
}

/**
 * Formats a relative duration into human-readable English.
 */
export function formatRelativeDuration(seconds: number, isPast: boolean): string {
  const prefix = isPast ? '' : 'in ';
  const suffix = isPast ? ' ago' : '';

  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${prefix}${seconds} second${seconds === 1 ? '' : 's'}${suffix}`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${prefix}${minutes} minute${minutes === 1 ? '' : 's'}${suffix}`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${prefix}${hours} hour${hours === 1 ? '' : 's'}${suffix}`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${prefix}${days} day${days === 1 ? '' : 's'}${suffix}`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${prefix}${months} month${months === 1 ? '' : 's'}${suffix}`;

  const years = Math.floor(days / 365);
  return `${prefix}${years} year${years === 1 ? '' : 's'}${suffix}`;
}
