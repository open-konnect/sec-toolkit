import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Shield } from 'lucide-react';
import { PrivacyNotice } from '../ui/PrivacyNotice';

export const Navbar: React.FC = () => {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const currentCategory = searchParams.get('category');

  const navCategories = [
    { name: 'All Tools', path: '/', isAll: true },
    { name: 'Security', path: '/?category=security', id: 'security' },
    { name: 'Encoding', path: '/?category=encoding', id: 'encoding' },
    { name: 'Data', path: '/?category=data', id: 'data' },
    { name: 'Developer', path: '/?category=developer', id: 'developer' },
    { name: 'AI', path: '/?category=ai', id: 'ai' }
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand */}
        <Link
          to="/"
          className="flex items-center gap-2.5 text-white hover:text-emerald-400 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 rounded-lg p-1 shrink-0"
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center shadow-md shadow-emerald-950/40 text-slate-950">
            <Shield className="w-4 h-4 text-slate-950 stroke-[2.5]" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-sm tracking-tight leading-tight flex items-center gap-1.5">
              <span>Security Toolkit</span>
              <span className="text-[10px] font-mono font-medium px-1.5 py-0.2 rounded bg-emerald-950 border border-emerald-800/60 text-emerald-300">
                15 Tools
              </span>
            </span>
            <span className="text-[10px] font-mono text-slate-400">100% Client-Side</span>
          </div>
        </Link>

        {/* Navigation Categories Desktop */}
        <nav className="hidden lg:flex items-center gap-1">
          {navCategories.map((item) => {
            const isActive = item.isAll
              ? location.pathname === '/' && !currentCategory
              : currentCategory === item.id;

            return (
              <Link
                key={item.name}
                to={item.path}
                className={`text-xs font-mono font-medium px-3 py-1.5 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-slate-800 text-emerald-400 font-bold border border-slate-700/80'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* Right side items */}
        <div className="flex items-center gap-3 shrink-0">
          <PrivacyNotice compact />
        </div>
      </div>

      {/* Mobile Horizontally Scrollable Category Bar */}
      <div className="lg:hidden px-4 py-2 border-t border-slate-900 bg-slate-950/95 overflow-x-auto flex items-center gap-2 scrollbar-none">
        {navCategories.map((item) => {
          const isActive = item.isAll
            ? location.pathname === '/' && !currentCategory
            : currentCategory === item.id;

          return (
            <Link
              key={item.name}
              to={item.path}
              className={`text-xs font-mono whitespace-nowrap px-3 py-1 rounded-md transition-colors ${
                isActive
                  ? 'bg-emerald-600 text-white font-bold'
                  : 'text-slate-400 hover:text-slate-200 bg-slate-900 border border-slate-800'
              }`}
            >
              {item.name}
            </Link>
          );
        })}
      </div>
    </header>
  );
};
