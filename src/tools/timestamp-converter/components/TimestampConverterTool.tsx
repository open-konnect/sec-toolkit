import React, { useState, useEffect } from 'react';
import { parseEpoch, parseDateString } from '../logic/timestampConverter';
import { TimestampConversionDetails } from '../types';
import { CopyButton } from '../../../components/ui/CopyButton';
import { Clock, Calendar, RefreshCw } from 'lucide-react';
import { analytics } from '../../../lib/analytics';

export const TimestampConverterTool: React.FC = () => {
  const [currentEpoch, setCurrentEpoch] = useState<number>(Math.floor(Date.now() / 1000));
  const [epochInput, setEpochInput] = useState<string>(String(Math.floor(Date.now() / 1000)));
  const [dateInput, setDateInput] = useState<string>(new Date().toISOString().slice(0, 19));

  const [epochResult, setEpochResult] = useState<TimestampConversionDetails | null>(null);
  const [dateResult, setDateResult] = useState<TimestampConversionDetails | null>(null);

  // Live clock ticker
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentEpoch(Math.floor(Date.now() / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Update conversions
  useEffect(() => {
    setEpochResult(parseEpoch(epochInput));
  }, [epochInput]);

  useEffect(() => {
    setDateResult(parseDateString(dateInput));
  }, [dateInput]);

  const handleSetCurrent = () => {
    const nowSec = Math.floor(Date.now() / 1000);
    setEpochInput(String(nowSec));
    setDateInput(new Date().toISOString().slice(0, 19));
    analytics.track('tool_used', { tool: 'timestamp-converter', action: 'set_now' });
  };

  const handleEpochChange = (val: string) => {
    setEpochInput(val);
  };

  const handleDateChange = (val: string) => {
    setDateInput(val);
  };

  return (
    <div className="space-y-8">
      {/* Live Epoch Clock Header */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 to-slate-900/60 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-950/80 border border-emerald-800/60 flex items-center justify-center text-emerald-400">
            <Clock className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block">
              Current Unix Epoch (Seconds)
            </span>
            <span className="text-2xl font-mono font-bold text-white tracking-tight">
              {currentEpoch}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <CopyButton text={String(currentEpoch)} label="Copy Now" />
          <button
            type="button"
            onClick={handleSetCurrent}
            className="text-xs font-mono px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition-colors flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reset to Now</span>
          </button>
        </div>
      </div>

      {/* Conversion Sections: Two-column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Section 1: Epoch -> Date */}
        <div className="space-y-4 p-5 rounded-2xl bg-slate-900/40 border border-slate-800">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white tracking-tight">
              Convert Unix Epoch → Human Date
            </h3>
          </div>

          <div className="space-y-2">
            <label htmlFor="epoch-input" className="text-xs font-mono text-slate-400 block">
              Enter Unix Epoch (seconds or milliseconds):
            </label>
            <input
              id="epoch-input"
              type="text"
              value={epochInput}
              onChange={(e) => handleEpochChange(e.target.value)}
              placeholder="e.g. 1774880000"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-800 bg-slate-950 font-mono text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {epochResult ? (
            <div className="divide-y divide-slate-800/80 rounded-xl border border-slate-800 bg-slate-950/60 font-mono text-xs">
              <div className="p-3 flex items-center justify-between">
                <span className="text-slate-400">ISO 8601:</span>
                <div className="flex items-center gap-2">
                  <span className="text-emerald-300 font-semibold">{epochResult.isoString}</span>
                  <CopyButton text={epochResult.isoString} />
                </div>
              </div>
              <div className="p-3 flex items-center justify-between">
                <span className="text-slate-400">UTC Date:</span>
                <div className="flex items-center gap-2">
                  <span className="text-slate-200">{epochResult.utcString}</span>
                  <CopyButton text={epochResult.utcString} />
                </div>
              </div>
              <div className="p-3 flex items-center justify-between">
                <span className="text-slate-400">Local Time:</span>
                <div className="flex items-center gap-2">
                  <span className="text-slate-200">{epochResult.localString}</span>
                  <CopyButton text={epochResult.localString} />
                </div>
              </div>
              <div className="p-3 flex items-center justify-between">
                <span className="text-slate-400">Relative:</span>
                <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                  {epochResult.relative}
                </span>
              </div>
            </div>
          ) : (
            <div className="p-4 text-xs font-mono text-rose-400 bg-rose-950/20 border border-rose-900/40 rounded-xl">
              Invalid numeric timestamp. Please enter a valid number.
            </div>
          )}
        </div>

        {/* Section 2: Date -> Epoch */}
        <div className="space-y-4 p-5 rounded-2xl bg-slate-900/40 border border-slate-800">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white tracking-tight">
              Convert Date / Time → Unix Epoch
            </h3>
          </div>

          <div className="space-y-2">
            <label htmlFor="date-input" className="text-xs font-mono text-slate-400 block">
              Enter Date String or ISO Format:
            </label>
            <input
              id="date-input"
              type="text"
              value={dateInput}
              onChange={(e) => handleDateChange(e.target.value)}
              placeholder="e.g. 2026-03-30T12:00:00Z"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-800 bg-slate-950 font-mono text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {dateResult ? (
            <div className="divide-y divide-slate-800/80 rounded-xl border border-slate-800 bg-slate-950/60 font-mono text-xs">
              <div className="p-3 flex items-center justify-between">
                <span className="text-slate-400">Unix Seconds:</span>
                <div className="flex items-center gap-2">
                  <span className="text-emerald-300 font-semibold">{dateResult.seconds}</span>
                  <CopyButton text={String(dateResult.seconds)} />
                </div>
              </div>
              <div className="p-3 flex items-center justify-between">
                <span className="text-slate-400">Unix Milliseconds:</span>
                <div className="flex items-center gap-2">
                  <span className="text-slate-200">{dateResult.milliseconds}</span>
                  <CopyButton text={String(dateResult.milliseconds)} />
                </div>
              </div>
              <div className="p-3 flex items-center justify-between">
                <span className="text-slate-400">Day of Week:</span>
                <span className="text-slate-300 font-semibold">{dateResult.dayOfWeek}</span>
              </div>
              <div className="p-3 flex items-center justify-between">
                <span className="text-slate-400">Relative Time:</span>
                <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                  {dateResult.relative}
                </span>
              </div>
            </div>
          ) : (
            <div className="p-4 text-xs font-mono text-rose-400 bg-rose-950/20 border border-rose-900/40 rounded-xl">
              Invalid date format. Use ISO format (e.g. YYYY-MM-DDTHH:mm:ssZ).
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
