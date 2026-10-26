import React from 'react';
import { CopyButton } from './CopyButton';
import { formatUnixTimestamp } from '../../lib/formatting/timestamp';
import { safeJsonStringify } from '../../lib/security/safeParser';
import { Calendar, Clock } from 'lucide-react';

export interface JsonViewerProps {
  data: unknown;
  title?: string;
  highlightTimestamps?: boolean;
  className?: string;
}

export const JsonViewer: React.FC<JsonViewerProps> = ({
  data,
  title,
  highlightTimestamps = true,
  className = ''
}) => {
  if (data === null || data === undefined) {
    return (
      <div className="p-4 text-xs font-mono text-slate-500 italic bg-slate-900/60 rounded-lg border border-slate-800">
        Empty data
      </div>
    );
  }

  const rawString = safeJsonStringify(data, 2);

  const isObject = typeof data === 'object' && data !== null && !Array.isArray(data);
  const entries = isObject ? Object.entries(data as Record<string, unknown>) : [];

  return (
    <div className={`rounded-xl border border-slate-800 bg-slate-900/70 overflow-hidden ${className}`}>
      {title && (
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800 bg-slate-950/60">
          <span className="font-mono text-xs font-semibold text-slate-300">{title}</span>
          <CopyButton text={rawString} />
        </div>
      )}

      {isObject && entries.length > 0 ? (
        <div className="divide-y divide-slate-800/60 font-mono text-xs">
          {entries.map(([key, value]) => {
            const isTimestampKey = highlightTimestamps && ['exp', 'iat', 'nbf', 'auth_time'].includes(key.toLowerCase());
            const timestampInfo = isTimestampKey && typeof value === 'number' ? formatUnixTimestamp(value) : null;

            return (
              <div key={key} className="p-3.5 hover:bg-slate-800/30 transition-colors">
                <div className="flex flex-wrap items-baseline gap-2 mb-1">
                  <span className="font-semibold text-emerald-400 select-all">{`"${key}"`}:</span>
                  <span className="text-slate-200 break-all select-all">
                    {renderValue(value)}
                  </span>
                </div>

                {timestampInfo && (
                  <div className="mt-2 p-2 rounded-md bg-slate-950/80 border border-slate-800/90 text-xs text-slate-300 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                    <div className="flex items-center gap-1.5 text-slate-400">
                      <Calendar className="w-3.5 h-3.5 text-slate-500" />
                      <span>UTC: <strong className="text-slate-200 font-mono">{timestampInfo.utcString}</strong></span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-500" />
                      <span className={`font-mono text-xs px-2 py-0.5 rounded ${
                        key === 'exp' 
                          ? (timestampInfo.isPast ? 'bg-rose-950/80 text-rose-300 border border-rose-800/60' : 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/60')
                          : 'bg-slate-800 text-slate-300'
                      }`}>
                        {timestampInfo.relative}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="p-4 font-mono text-xs text-slate-200 overflow-x-auto whitespace-pre">
          {rawString}
        </div>
      )}
    </div>
  );
};

function renderValue(value: unknown): React.ReactNode {
  if (value === null) return <span className="text-amber-400">null</span>;
  if (typeof value === 'boolean') return <span className="text-purple-400">{String(value)}</span>;
  if (typeof value === 'number') return <span className="text-sky-400">{value}</span>;
  if (typeof value === 'string') return <span className="text-amber-200">"{value}"</span>;
  if (Array.isArray(value)) return <span className="text-slate-400">[{value.map(v => JSON.stringify(v)).join(', ')}]</span>;
  if (typeof value === 'object') return <span className="text-slate-400">{JSON.stringify(value)}</span>;
  return <span>{String(value)}</span>;
}
