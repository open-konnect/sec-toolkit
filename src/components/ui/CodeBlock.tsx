import React from 'react';
import { CopyButton } from './CopyButton';

export interface CodeBlockProps {
  code: string;
  language?: string;
  title?: string;
  showCopy?: boolean;
  maxHeight?: string;
  className?: string;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({
  code,
  language = 'text',
  title,
  showCopy = true,
  maxHeight = 'max-h-96',
  className = ''
}) => {
  return (
    <div className={`rounded-lg border border-slate-800 bg-slate-900/90 overflow-hidden flex flex-col ${className}`}>
      {(title || showCopy) && (
        <div className="flex items-center justify-between px-3.5 py-2 border-b border-slate-800/80 bg-slate-950/60 text-xs">
          <span className="font-mono text-slate-400 font-medium">{title || language}</span>
          {showCopy && <CopyButton text={code} />}
        </div>
      )}
      <div className={`p-4 overflow-x-auto overflow-y-auto ${maxHeight} text-xs font-mono leading-relaxed text-slate-200 selection:bg-brand-500 selection:text-slate-950`}>
        <pre className="whitespace-pre">{code}</pre>
      </div>
    </div>
  );
};
