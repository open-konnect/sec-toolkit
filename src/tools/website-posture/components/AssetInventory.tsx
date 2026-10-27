import React from 'react';
import { AssetStats } from '../logic/report/assetModel';

export interface AssetInventoryProps {
  stats: AssetStats;
  children?: React.ReactNode;
}

/**
 * Inventory statistics. Counts are references found in page markup, listed
 * once per distinct resource — they are not downloaded or inspected files.
 */
export const AssetInventory: React.FC<AssetInventoryProps> = ({ stats, children }) => {
  const items: ReadonlyArray<{ label: string; value: number }> = [
    { label: 'Pages crawled', value: stats.pagesCrawled },
    { label: 'Resources discovered', value: stats.resourcesDiscovered },
    { label: 'JavaScript', value: stats.javascript },
    { label: 'CSS', value: stats.css },
    { label: 'Images', value: stats.images },
    { label: 'Fonts', value: stats.fonts },
    { label: 'Iframes', value: stats.iframes },
    { label: 'Media', value: stats.media },
    { label: 'Object / embed', value: stats.objectsAndEmbeds },
    { label: 'Other', value: stats.other },
    { label: 'First-party', value: stats.firstParty },
    { label: 'Same-site', value: stats.sameSite },
    { label: 'Third-party', value: stats.thirdParty },
    { label: 'HTTP', value: stats.http },
    { label: 'HTTPS', value: stats.https },
    { label: 'External domains', value: stats.externalDomains }
  ];

  return (
    <section aria-labelledby="inventory-title" className="space-y-4">
      <div className="space-y-1">
        <h3 id="inventory-title" className="text-sm font-bold text-white tracking-tight">
          Asset and resource inventory
        </h3>
        <p className="text-xs text-slate-500 leading-relaxed">
          Resources are listed from the markup of the pages that were read. They were not downloaded or
          inspected, and anything a script adds at runtime is not included.
          {stats.unresolvedReferences > 0 &&
            ` ${stats.unresolvedReferences} inline or unparseable ${stats.unresolvedReferences === 1 ? 'reference was' : 'references were'} not listed.`}
        </p>
      </div>
      {stats.pagesCrawled > 0 && stats.inlineScripts > 0 && stats.resourcesDiscovered < 10 && (
        <p role="note" className="text-xs text-amber-300 leading-relaxed">
          These pages contain {stats.inlineScripts} inline {stats.inlineScripts === 1 ? 'script' : 'scripts'} but
          reference only {stats.resourcesDiscovered} {stats.resourcesDiscovered === 1 ? 'resource' : 'resources'} in
          their markup. Sites that build themselves with JavaScript load most of their assets at runtime, which a
          passive read of the markup cannot see, so a low count does not mean the site loads little.
        </p>
      )}
      <dl className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
        {items.map((item) => (
          <div key={item.label} className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
            <dt className="text-[10px] font-mono uppercase tracking-wider text-slate-500">{item.label}</dt>
            <dd className="text-base font-bold text-white tabular-nums">{item.value}</dd>
          </div>
        ))}
      </dl>
      {children}
    </section>
  );
};
