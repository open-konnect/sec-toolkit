import { TimestampConversionDetails } from '../types';
import { formatRelativeDuration } from '../../../lib/formatting/timestamp';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Parses numeric epoch timestamp in seconds or milliseconds and produces formatted date breakdown.
 */
export function parseEpoch(input: number | string): TimestampConversionDetails | null {
  if (input === '' || input === null || input === undefined) return null;

  const num = typeof input === 'number' ? input : Number(String(input).trim());
  if (isNaN(num) || !isFinite(num)) return null;

  // Detect whether seconds or milliseconds based on magnitude
  // Milliseconds around 2026 epoch are ~1.77e12, seconds are ~1.77e9
  const isSeconds = Math.abs(num) < 1e11;
  const ms = isSeconds ? num * 1000 : num;
  const sec = isSeconds ? num : Math.floor(num / 1000);

  const date = new Date(ms);
  if (isNaN(date.getTime())) return null;

  const now = Date.now();
  const diffSec = Math.round((ms - now) / 1000);
  const isPast = diffSec < 0;

  return {
    seconds: sec,
    milliseconds: ms,
    isoString: date.toISOString(),
    utcString: date.toUTCString(),
    localString: date.toLocaleString(),
    relative: formatRelativeDuration(Math.abs(diffSec), isPast),
    dayOfWeek: DAYS[date.getUTCDay()],
    isPast
  };
}

/**
 * Converts ISO 8601 or local date string to epoch timestamps.
 */
export function parseDateString(dateString: string): TimestampConversionDetails | null {
  if (!dateString || !dateString.trim()) return null;

  const date = new Date(dateString.trim());
  if (isNaN(date.getTime())) return null;

  const ms = date.getTime();
  const sec = Math.floor(ms / 1000);
  const now = Date.now();
  const diffSec = Math.round((ms - now) / 1000);
  const isPast = diffSec < 0;

  return {
    seconds: sec,
    milliseconds: ms,
    isoString: date.toISOString(),
    utcString: date.toUTCString(),
    localString: date.toLocaleString(),
    relative: formatRelativeDuration(Math.abs(diffSec), isPast),
    dayOfWeek: DAYS[date.getUTCDay()],
    isPast
  };
}
