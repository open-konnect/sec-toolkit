import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Shield } from 'lucide-react';
import { PrivacyNotice } from '../ui/PrivacyNotice';

export const Navbar: React.FC = () => {
  const location = useLocation();

  const navLinks = [
    { name: 'All Tools', path: '/' },
    { name: 'JWT Analyzer', path: '/jwt-decoder' },
    { name: 'Base64', path: '/base64' },
    { name: 'UUID Generator', path: '/uuid-generator' }
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand */}
        <Link
          to="/"
          className="flex items-center gap-2.5 text-white hover:text-emerald-400 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 rounded-lg p-1"
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center shadow-md shadow-emerald-950/40 text-slate-950">
            <Shield className="w-5 h-5 text-slate-950 stroke-[2.5]" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-sm tracking-tight leading-tight flex items-center gap-1.5">
              <span>Security Toolkit</span>
              <span className="text-[10px] font-mono font-medium px-1.5 py-0.2 rounded bg-emerald-950 border border-emerald-800/60 text-emerald-300">
                v1.0
              </span>
            </span>
            <span className="text-[11px] font-mono text-slate-400">100% Client-Side</span>
          </div>
        </Link>

        {/* Navigation Links */}
        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => {
            const isActive = location.pathname === link.path;
            return (
              <Link
                key={link.path}
                to={link.path}
                className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-slate-800 text-white font-semibold shadow-inner'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                {link.name}
              </Link>
            );
          })}
        </nav>

        {/* Right side items */}
        <div className="flex items-center gap-3">
          <PrivacyNotice compact />
        </div>
      </div>
    </header>
  );
};
