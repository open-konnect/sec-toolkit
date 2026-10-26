import React from 'react';
import { Link } from 'react-router-dom';
import { 
  ArrowRight, 
  ShieldCheck, 
  Shield, 
  Binary, 
  Fingerprint, 
  FileJson, 
  Hash, 
  Globe, 
  Clock, 
  Search, 
  Calendar, 
  Key, 
  Code2, 
  Server, 
  Lock, 
  Cpu,
  Wrench
} from 'lucide-react';
import { Badge } from '../ui/Badge';
import { ToolDefinition } from '../../types';

export interface ToolCardProps {
  tool: ToolDefinition;
  compact?: boolean;
}

function getToolIcon(iconName?: string) {
  switch (iconName) {
    case 'Shield': return <Shield className="w-4 h-4 text-emerald-400" />;
    case 'Binary': return <Binary className="w-4 h-4 text-cyan-400" />;
    case 'Fingerprint': return <Fingerprint className="w-4 h-4 text-teal-400" />;
    case 'FileJson': return <FileJson className="w-4 h-4 text-amber-400" />;
    case 'Hash': return <Hash className="w-4 h-4 text-rose-400" />;
    case 'Globe': return <Globe className="w-4 h-4 text-blue-400" />;
    case 'Clock': return <Clock className="w-4 h-4 text-indigo-400" />;
    case 'Search': return <Search className="w-4 h-4 text-purple-400" />;
    case 'Calendar': return <Calendar className="w-4 h-4 text-emerald-400" />;
    case 'Key': return <Key className="w-4 h-4 text-yellow-400" />;
    case 'Code2': return <Code2 className="w-4 h-4 text-sky-400" />;
    case 'Server': return <Server className="w-4 h-4 text-red-400" />;
    case 'Lock': return <Lock className="w-4 h-4 text-emerald-400" />;
    case 'Cpu': return <Cpu className="w-4 h-4 text-pink-400" />;
    default: return <Wrench className="w-4 h-4 text-emerald-400" />;
  }
}

export const ToolCard: React.FC<ToolCardProps> = ({ tool, compact = false }) => {
  return (
    <Link
      to={`/${tool.slug}`}
      className={`group relative flex flex-col justify-between rounded-2xl bg-slate-900/70 border border-slate-800/90 hover:border-emerald-500/50 hover:bg-slate-900 transition-all duration-200 shadow-sm hover:shadow-lg hover:shadow-emerald-950/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ${compact ? 'p-4' : 'p-5'}`}
    >
      <div>
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-slate-950 border border-slate-800">
              {getToolIcon(tool.iconName)}
            </span>
            <span className="text-[11px] font-mono font-medium text-emerald-400 uppercase tracking-wider">
              {tool.category}
            </span>
          </div>
          {tool.badge && (
            <Badge variant="info" size="sm">
              {tool.badge}
            </Badge>
          )}
        </div>

        <h3 className="text-base font-bold text-white group-hover:text-emerald-300 transition-colors tracking-tight mb-1.5">
          {tool.name}
        </h3>

        <p className="text-xs text-slate-400 leading-relaxed mb-4 line-clamp-2">
          {tool.shortDescription}
        </p>
      </div>

      <div className="pt-3 border-t border-slate-800/60 flex items-center justify-between">
        <span className="flex items-center gap-1 text-[10px] font-mono text-slate-500">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500/80" />
          Client-Side
        </span>

        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 group-hover:text-emerald-300 group-hover:translate-x-0.5 transition-all">
          <span>Open Tool</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </span>
      </div>
    </Link>
  );
};
