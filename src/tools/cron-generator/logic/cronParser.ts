import { CronScheduleOption } from '../types';

/**
 * Builds standard 5-part cron string from structured option.
 */
export function buildCronFromOption(option: CronScheduleOption): string {
  switch (option.type) {
    case 'every-minute':
      return '* * * * *';
    case 'every-n-minutes':
      return `*/${option.minuteInterval || 5} * * * *`;
    case 'hourly':
      return `${option.minute ?? 0} * * * *`;
    case 'daily':
      return `${option.minute ?? 0} ${option.hour ?? 0} * * *`;
    case 'weekdays':
      return `${option.minute ?? 0} ${option.hour ?? 9} * * 1-5`;
    case 'weekly':
      return `${option.minute ?? 0} ${option.hour ?? 0} * * ${option.dayOfWeek ?? 1}`;
    case 'monthly':
      return `${option.minute ?? 0} ${option.hour ?? 0} ${option.dayOfMonth ?? 1} * *`;
    case 'custom':
      return (option.customExpression || '* * * * *').trim();
    default:
      return '* * * * *';
  }
}

/**
 * Generates natural language human description of standard cron expressions.
 */
export function explainCron(expression: string): { description: string; isValid: boolean; error?: string } {
  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) {
    return {
      description: '',
      isValid: false,
      error: `Standard Unix cron must have exactly 5 parts (minute, hour, day of month, month, day of week). Found ${parts.length} part${parts.length === 1 ? '' : 's'}.`
    };
  }

  const [min, hour, dom, mon, dow] = parts;

  // Basic validation of characters
  const validPartRegex = /^[0-9*,\/-]+$/;
  for (const part of parts) {
    if (!validPartRegex.test(part)) {
      return {
        description: '',
        isValid: false,
        error: `Invalid character in cron field "${part}". Allowed characters: digits, *, ,, -, /`
      };
    }
  }

  if (expression === '* * * * *') {
    return { description: 'Every minute, every hour, every day.', isValid: true };
  }

  if (min.startsWith('*/') && hour === '*' && dom === '*' && mon === '*' && dow === '*') {
    const interval = min.slice(2);
    return { description: `Every ${interval} minutes, every hour of every day.`, isValid: true };
  }

  if (min !== '*' && hour === '*' && dom === '*' && mon === '*' && dow === '*') {
    return { description: `Hourly at minute ${min}.`, isValid: true };
  }

  if (min !== '*' && hour !== '*' && dom === '*' && mon === '*' && dow === '*') {
    const pad = (n: string) => n.padStart(2, '0');
    return { description: `Daily at ${pad(hour)}:${pad(min)} UTC.`, isValid: true };
  }

  if (min !== '*' && hour !== '*' && dom === '*' && mon === '*' && (dow === '1-5' || dow === 'MON-FRI')) {
    const pad = (n: string) => n.padStart(2, '0');
    return { description: `Every weekday (Monday through Friday) at ${pad(hour)}:${pad(min)} UTC.`, isValid: true };
  }

  return {
    description: `Runs at minute ${min}, hour ${hour}, day of month ${dom}, month ${mon}, day of week ${dow}.`,
    isValid: true
  };
}

/**
 * Calculates next N future execution timestamps for typical cron expressions.
 */
export function getNextExecutions(expression: string, count = 5): string[] {
  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) return [];

  const results: string[] = [];
  const [minStr, hourStr, , , dowStr] = parts;

  // Safe client-side projection for common patterns
  let current = new Date();
  // round to next clean minute
  current.setSeconds(0, 0);
  current.setMinutes(current.getMinutes() + 1);

  for (let i = 0; i < 1440 && results.length < count; i++) {
    const m = current.getMinutes();
    const h = current.getHours();
    const dow = current.getDay();

    let matchesMin = false;
    if (minStr === '*') matchesMin = true;
    else if (minStr.startsWith('*/')) {
      const step = parseInt(minStr.slice(2), 10);
      matchesMin = !isNaN(step) && step > 0 && m % step === 0;
    } else {
      matchesMin = parseInt(minStr, 10) === m;
    }

    let matchesHour = false;
    if (hourStr === '*') matchesHour = true;
    else if (hourStr.startsWith('*/')) {
      const step = parseInt(hourStr.slice(2), 10);
      matchesHour = !isNaN(step) && step > 0 && h % step === 0;
    } else {
      matchesHour = parseInt(hourStr, 10) === h;
    }

    let matchesDow = true;
    if (dowStr === '1-5') {
      matchesDow = dow >= 1 && dow <= 5;
    } else if (dowStr !== '*') {
      matchesDow = parseInt(dowStr, 10) === dow;
    }

    if (matchesMin && matchesHour && matchesDow) {
      results.push(current.toUTCString());
    }

    // Step forward 1 minute
    current = new Date(current.getTime() + 60000);
  }

  return results;
}
