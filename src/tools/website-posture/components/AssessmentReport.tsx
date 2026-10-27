import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SecurityAssessment } from '../types';
import { buildAssetModel, indexAssetModel } from '../logic/report/assetModel';
import { AssessmentSummary } from './AssessmentSummary';
import { AssetGraph } from './AssetGraph';
import { AssetInventory } from './AssetInventory';
import { ExternalDomainInventory } from './ExternalDomainInventory';
import { FetchProblems } from './FetchProblems';
import { findingDomId } from './FindingCard';
import { FindingList } from './FindingList';
import { RelatedTools } from './RelatedTools';
import { ResourceTable, resourceRowId } from './ResourceTable';
import { UnableToVerify } from './UnableToVerify';
import { WhatWeChecked } from './WhatWeChecked';

export interface AssessmentReportProps {
  assessment: SecurityAssessment;
}

function scrollToId(id: string): void {
  if (typeof document === 'undefined') return;
  // Wait a frame so a section that just opened has rendered.
  window.requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView?.({ block: 'center' }));
}

/**
 * The report. Holds only cross-section navigation state; every number and
 * grouping shown here comes from the assessment or the pure report model.
 */
export const AssessmentReport: React.FC<AssessmentReportProps> = ({ assessment }) => {
  const model = useMemo(() => buildAssetModel(assessment), [assessment]);
  const index = useMemo(() => indexAssetModel(model), [model]);
  const findingsById = useMemo(
    () => new Map(assessment.findings.map((finding) => [finding.id, finding])),
    [assessment.findings]
  );
  const resourceIdsByUrl = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const resource of model.resources) {
      map.set(resource.url, [...(map.get(resource.url) ?? []), resource.id]);
    }
    return map;
  }, [model.resources]);

  const [selectedResourceId, setSelectedResourceId] = useState<string | null>(null);
  const [hostFilter, setHostFilter] = useState<string | null>(null);
  const [focusFindingId, setFocusFindingId] = useState<string | null>(null);
  const [graphFocus, setGraphFocus] = useState<{ nodeId: string; nonce: number } | null>(null);
  const nonce = useRef(0);

  const showResource = useCallback((resourceId: string) => {
    setSelectedResourceId(resourceId);
    scrollToId(resourceRowId(resourceId));
  }, []);

  const showDomainResources = useCallback((host: string) => {
    setSelectedResourceId(null);
    setHostFilter(host);
    scrollToId('resource-search');
  }, []);

  const showInMap = useCallback((nodeId: string) => {
    nonce.current += 1;
    setGraphFocus({ nodeId, nonce: nonce.current });
  }, []);

  const showFinding = useCallback((findingId: string) => {
    setFocusFindingId(findingId);
    scrollToId(findingDomId(findingId));
  }, []);

  useEffect(() => {
    setSelectedResourceId(null);
    setHostFilter(null);
    setFocusFindingId(null);
    setGraphFocus(null);
  }, [assessment]);

  return (
    <div className="space-y-10">
      <AssessmentSummary assessment={assessment} />

      <FetchProblems assessment={assessment} />

      <section aria-labelledby="findings-title" className="space-y-3">
        <h3 id="findings-title" className="text-sm font-bold text-white tracking-tight">
          Findings by category
        </h3>
        <FindingList
          findings={assessment.findings}
          resourceIdsByUrl={resourceIdsByUrl}
          onShowResource={showResource}
          focusFindingId={focusFindingId}
        />
      </section>

      <AssetInventory stats={model.stats}>
        <details className="rounded-xl border border-slate-800 bg-slate-900/30">
          <summary className="cursor-pointer p-3 text-xs font-mono text-slate-300">
            Pages analyzed ({model.pages.length})
          </summary>
          <ul className="p-3 pt-0 space-y-0.5">
            {model.pages.map((page) => (
              <li key={page.id} className="font-mono text-[11px] text-slate-400 break-all">
                {page.url}
                {page.title ? ` — ${page.title}` : ''}
              </li>
            ))}
          </ul>
        </details>

        <h4 className="text-xs font-bold text-slate-200">Resources</h4>
        <ResourceTable
          model={model}
          findingsById={findingsById}
          selectedResourceId={selectedResourceId}
          hostFilter={hostFilter}
          onShowInMap={showInMap}
          onShowFinding={showFinding}
        />

        <h4 className="text-xs font-bold text-slate-200">External domains</h4>
        <p className="text-xs text-slate-500 leading-relaxed">
          Hostnames other than the target’s own. A label such as “Known CDN or static host” comes from a
          built-in list of well-known hostnames; it says nothing about what the domain does with requests.
        </p>
        <ExternalDomainInventory model={model} onShowResources={showDomainResources} onShowInMap={showInMap} />
      </AssetInventory>

      <AssetGraph
        model={model}
        index={index}
        findingsById={findingsById}
        focus={graphFocus}
        onShowResource={showResource}
        onShowDomainResources={showDomainResources}
        onShowFinding={showFinding}
      />

      <WhatWeChecked assessment={assessment} />
      <UnableToVerify assessment={assessment} />
      <RelatedTools />
    </div>
  );
};
