import React, { useState, useMemo } from 'react';
import { buildCronFromOption, explainCron, getNextExecutions } from '../logic/cronParser';
import { CronScheduleOption } from '../types';
import { CopyButton } from '../../../components/ui/CopyButton';
import { ErrorMessage } from '../../../components/ui/ErrorMessage';
import { Clock, CheckCircle2 } from 'lucide-react';
import { analytics } from '../../../lib/analytics';

export const CronGeneratorTool: React.FC = () => {
  const [scheduleType, setScheduleType] = useState<CronScheduleOption['type']>('every-n-minutes');
  const [minuteInterval, setMinuteInterval] = useState<number>(15);
  const [selectedHour, setSelectedHour] = useState<number>(9);
  const [selectedMinute, setSelectedMinute] = useState<number>(0);
  const [customInput, setCustomInput] = useState<string>('0 9 * * 1-5');

  const cronExpression = useMemo(() => {
    if (scheduleType === 'custom') return customInput.trim();
    return buildCronFromOption({
      type: scheduleType,
      minuteInterval,
      hour: selectedHour,
      minute: selectedMinute
    });
  }, [scheduleType, minuteInterval, selectedHour, selectedMinute, customInput]);

  const explanation = useMemo(() => {
    return explainCron(cronExpression);
  }, [cronExpression]);

  const nextRuns = useMemo(() => {
    if (!explanation.isValid) return [];
    return getNextExecutions(cronExpression, 5);
  }, [cronExpression, explanation.isValid]);

  const handleTypeChange = (type: CronScheduleOption['type']) => {
    setScheduleType(type);
    analytics.track('tool_used', { tool: 'cron-generator', action: 'select_schedule', scheduleType: type });
  };

  return (
    <div className="space-y-6">
      {/* Schedule Builder Type Selector */}
      <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
        <span className="text-xs font-mono text-slate-400 font-semibold uppercase tracking-wider block">
          Schedule Frequency:
        </span>
        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: 'every-minute', label: 'Every Minute' },
            { id: 'every-n-minutes', label: 'Every N Minutes' },
            { id: 'hourly', label: 'Hourly' },
            { id: 'daily', label: 'Daily at Time' },
            { id: 'weekdays', label: 'Weekdays (Mon–Fri)' },
            { id: 'custom', label: 'Custom Expression' }
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => handleTypeChange(item.id as CronScheduleOption['type'])}
              className={`text-xs font-mono px-3.5 py-2 rounded-lg border transition-all ${
                scheduleType === item.id
                  ? 'bg-emerald-600 border-emerald-500 text-white font-bold shadow-sm'
                  : 'bg-slate-950 border-slate-800 text-slate-300 hover:text-white hover:border-slate-700'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Dynamic Controls based on schedule type */}
        {scheduleType === 'every-n-minutes' && (
          <div className="pt-2 flex items-center gap-3 text-xs font-mono text-slate-300">
            <span>Every:</span>
            <div className="flex items-center gap-1.5">
              {[5, 10, 15, 30].map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => setMinuteInterval(mins)}
                  className={`px-3 py-1 rounded-md border ${
                    minuteInterval === mins
                      ? 'bg-slate-800 border-emerald-500 text-emerald-400 font-bold'
                      : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-white'
                  }`}
                >
                  {mins} min
                </button>
              ))}
            </div>
          </div>
        )}

        {(scheduleType === 'daily' || scheduleType === 'weekdays') && (
          <div className="pt-2 flex flex-wrap items-center gap-4 text-xs font-mono text-slate-300">
            <div className="flex items-center gap-2">
              <span>Hour (0–23):</span>
              <input
                type="number"
                min={0}
                max={23}
                value={selectedHour}
                onChange={(e) => setSelectedHour(Math.min(23, Math.max(0, parseInt(e.target.value) || 0)))}
                className="w-16 px-2.5 py-1 rounded border border-slate-800 bg-slate-950 text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <span>Minute (0–59):</span>
              <input
                type="number"
                min={0}
                max={59}
                value={selectedMinute}
                onChange={(e) => setSelectedMinute(Math.min(59, Math.max(0, parseInt(e.target.value) || 0)))}
                className="w-16 px-2.5 py-1 rounded border border-slate-800 bg-slate-950 text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>
        )}

        {scheduleType === 'custom' && (
          <div className="pt-2 space-y-1">
            <label htmlFor="custom-cron" className="text-xs font-mono text-slate-400 block">
              Enter 5-field cron expression (minute hour day-of-month month day-of-week):
            </label>
            <input
              id="custom-cron"
              type="text"
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              placeholder="e.g. */15 * * * *"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-800 bg-slate-950 font-mono text-xs text-white focus:outline-none focus:border-emerald-500"
            />
          </div>
        )}
      </div>

      {/* Generated Cron Expression Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 to-slate-900/60 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 block mb-1">
            Standard POSIX 5-Part Cron
          </span>
          <span className="text-2xl sm:text-3xl font-mono font-bold text-white select-all tracking-wider">
            {cronExpression}
          </span>
        </div>
        <CopyButton text={cronExpression} label="Copy Cron Expression" />
      </div>

      {/* Human Readable Explanation */}
      {explanation.isValid ? (
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <span className="text-xs font-mono font-semibold uppercase text-emerald-400 block mb-1">
              Natural Language Schedule
            </span>
            <p className="text-sm text-slate-200 font-sans leading-relaxed">
              {explanation.description}
            </p>
          </div>
        </div>
      ) : (
        <ErrorMessage message={explanation.error || 'Invalid cron expression.'} />
      )}

      {/* Next Execution Times */}
      {nextRuns.length > 0 && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-slate-800 bg-slate-950/60 text-xs font-mono text-slate-400 flex items-center gap-2">
            <Clock className="w-4 h-4 text-emerald-400" />
            <span>Next Estimated Executions (UTC):</span>
          </div>
          <div className="divide-y divide-slate-800/60 font-mono text-xs">
            {nextRuns.map((time, idx) => (
              <div key={idx} className="px-4 py-2.5 flex items-center justify-between text-slate-300">
                <span className="text-slate-500 text-[11px] w-6">#{idx + 1}</span>
                <span className="text-emerald-300 font-semibold">{time}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
