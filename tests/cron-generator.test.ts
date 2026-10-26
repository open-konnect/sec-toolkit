import { describe, it, expect } from 'vitest';
import { buildCronFromOption, explainCron } from '../src/tools/cron-generator/logic/cronParser';

describe('buildCronFromOption', () => {
  it('every-minute returns "* * * * *"', () => {
    expect(buildCronFromOption({ type: 'every-minute' })).toBe('* * * * *');
  });

  it('daily at 9:30 returns correct expression', () => {
    expect(buildCronFromOption({ type: 'daily', hour: 9, minute: 30 })).toBe('30 9 * * *');
  });

  it('weekdays with hour 8 minute 0 returns correct expression', () => {
    expect(buildCronFromOption({ type: 'weekdays', hour: 8, minute: 0 })).toBe('0 8 * * 1-5');
  });

  it('weekdays without explicit time defaults to 9:00', () => {
    expect(buildCronFromOption({ type: 'weekdays' })).toBe('0 9 * * 1-5');
  });

  it('hourly at minute 15 returns correct expression', () => {
    expect(buildCronFromOption({ type: 'hourly', minute: 15 })).toBe('15 * * * *');
  });

  it('every-n-minutes with interval 10 returns "*/10 * * * *"', () => {
    expect(buildCronFromOption({ type: 'every-n-minutes', minuteInterval: 10 })).toBe('*/10 * * * *');
  });

  it('monthly defaults to 1st at midnight', () => {
    expect(buildCronFromOption({ type: 'monthly' })).toBe('0 0 1 * *');
  });

  it('custom expression is returned as-is', () => {
    expect(buildCronFromOption({ type: 'custom', customExpression: '5 4 * * *' })).toBe('5 4 * * *');
  });
});

describe('explainCron', () => {
  it('"* * * * *" returns a valid description about every minute', () => {
    const result = explainCron('* * * * *');
    expect(result.isValid).toBe(true);
    expect(result.description).toContain('Every minute');
  });

  it('invalid cron with wrong number of parts returns isValid false', () => {
    const result = explainCron('* * *');
    expect(result.isValid).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('"30 9 * * *" returns a daily description', () => {
    const result = explainCron('30 9 * * *');
    expect(result.isValid).toBe(true);
    expect(result.description).toContain('Daily');
    expect(result.description).toContain('09:30');
  });

  it('"0 9 * * 1-5" returns a weekday description', () => {
    const result = explainCron('0 9 * * 1-5');
    expect(result.isValid).toBe(true);
    expect(result.description.toLowerCase()).toContain('weekday');
  });

  it('expression with invalid character returns isValid false', () => {
    const result = explainCron('* * * * @');
    expect(result.isValid).toBe(false);
  });
});
