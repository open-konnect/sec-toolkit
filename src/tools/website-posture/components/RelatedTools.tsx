import React from 'react';
import { Link } from 'react-router-dom';
import { FOCUS_RING } from './presentation';

const RELATED: ReadonlyArray<{ to: string; label: string; hint: string }> = [
  { to: '/security-headers', label: 'Security headers analyzer', hint: 'Paste response headers for a deeper look.' },
  { to: '/csp-generator', label: 'CSP generator', hint: 'Draft a Content-Security-Policy.' },
  { to: '/hash-generator', label: 'Hash generator', hint: 'Compute SRI hashes for scripts and styles.' }
];

export const RelatedTools: React.FC = () => (
  <section aria-labelledby="related-title" className="space-y-3">
    <h3 id="related-title" className="text-sm font-bold text-white tracking-tight">
      Related tools
    </h3>
    <ul className="grid grid-cols-1 sm:grid-cols-3 gap-2">
      {RELATED.map((tool) => (
        <li key={tool.to}>
          <Link
            to={tool.to}
            className={`block h-full p-3 rounded-xl bg-slate-900/40 border border-slate-800 hover:border-slate-600 ${FOCUS_RING}`}
          >
            <span className="block text-xs font-bold text-white">{tool.label}</span>
            <span className="block text-[11px] text-slate-400 mt-0.5">{tool.hint}</span>
          </Link>
        </li>
      ))}
    </ul>
  </section>
);
