export interface CronScheduleOption {
  type: 'every-minute' | 'every-n-minutes' | 'hourly' | 'daily' | 'weekdays' | 'weekly' | 'monthly' | 'custom';
  minuteInterval?: number;
  minute?: number;
  hour?: number;
  dayOfWeek?: number;
  dayOfMonth?: number;
  customExpression?: string;
}

export interface CronParseResult {
  expression: string;
  humanReadable: string;
  nextExecutions: string[];
  isValid: boolean;
  error?: string;
}
