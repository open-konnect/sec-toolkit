import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { TOOL_CATEGORIES } from '../../tools/registry';

export const Footer: React.FC = () => {
  return (
    <footer className="border-t border-slate-800/80 bg-slate-950/60 mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
          {/* Brand & Privacy Statement */}
          <div className="md:col-span-2 space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <span className="font-bold text-sm text-white">Developer Security Toolkit</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed max-w-md">
              Fast, private, browser-based utilities for developers, security engineers, and AI builders.
              All data processing happens locally in your browser. Zero tracking, zero storage, zero server calls.
            </p>
            <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800 text-xs text-slate-300">
              <span className="font-semibold text-emerald-400">Privacy Guarantee:</span> Your data stays in your browser. No account required.
            </div>
          </div>

          {/* Popular Tools */}
          <nav aria-labelledby="footer-popular-heading">
            <h2 id="footer-popular-heading" className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-300 mb-3">
              Popular Tools
            </h2>
            <ul className="space-y-2 text-xs">
              <li>
                <Link to="/jwt-decoder" className="text-slate-400 hover:text-emerald-400 transition-colors">
                  JWT Decoder & Analyzer
                </Link>
              </li>
              <li>
                <Link to="/json-formatter" className="text-slate-400 hover:text-emerald-400 transition-colors">
                  JSON Formatter & Validator
                </Link>
              </li>
              <li>
                <Link to="/hash-generator" className="text-slate-400 hover:text-emerald-400 transition-colors">
                  Hash Generator (SHA-256)
                </Link>
              </li>
              <li>
                <Link to="/base64" className="text-slate-400 hover:text-emerald-400 transition-colors">
                  Base64 & Base64URL
                </Link>
              </li>
              <li>
                <Link to="/regex-tester" className="text-slate-400 hover:text-emerald-400 transition-colors">
                  Regex Tester
                </Link>
              </li>
              <li>
                <Link to="/timestamp-converter" className="text-slate-400 hover:text-emerald-400 transition-colors">
                  Unix Timestamp Converter
                </Link>
              </li>
            </ul>
          </nav>

          {/* Categories */}
          <nav aria-labelledby="footer-categories-heading">
            <h2 id="footer-categories-heading" className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-300 mb-3">
              Tool Categories
            </h2>
            <ul className="space-y-2 text-xs">
              {TOOL_CATEGORIES.map((cat) => (
                <li key={cat.id}>
                  <Link
                    to={`/${cat.id}`}
                    className="text-slate-400 hover:text-emerald-400 transition-colors"
                  >
                    {cat.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        {/* Bottom bar */}
        <div className="pt-8 border-t border-slate-800/60 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div>
            © {new Date().getFullYear()} Developer Security Toolkit. Built for engineers.
          </div>
          <div className="flex items-center gap-6">
            <span>Static Deployment • Cloudflare Pages</span>
            <span>Zero Tracking</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
