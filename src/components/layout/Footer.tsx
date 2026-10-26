import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';

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
              Free, privacy-first developer utilities that run entirely in your browser.
              No tokens, keys, or data are ever transmitted to remote servers, logged, or retained.
            </p>
            <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800 text-xs text-slate-300">
              <span className="font-semibold text-emerald-400">Zero-Backend Architecture:</span> Everything is processed locally via native Web APIs, Web Crypto, and JavaScript.
            </div>
          </div>

          {/* Tools */}
          <div>
            <h4 className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-300 mb-3">
              Initial Release Tools
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link to="/jwt-decoder" className="text-slate-400 hover:text-emerald-400 transition-colors">
                  JWT Decoder & Security Analyzer
                </Link>
              </li>
              <li>
                <Link to="/base64" className="text-slate-400 hover:text-emerald-400 transition-colors">
                  Base64 & Base64URL Converter
                </Link>
              </li>
              <li>
                <Link to="/uuid-generator" className="text-slate-400 hover:text-emerald-400 transition-colors">
                  Cryptographic UUID Generator
                </Link>
              </li>
            </ul>
          </div>

          {/* Architecture & Future Categories */}
          <div>
            <h4 className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-300 mb-3">
              Planned Categories
            </h4>
            <ul className="space-y-1.5 text-xs text-slate-400">
              <li>• Security & Cryptography</li>
              <li>• Data Transformation & Formatting</li>
              <li>• Developer Utilities</li>
              <li>• AI & LLM Token Calculators</li>
            </ul>
          </div>
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
