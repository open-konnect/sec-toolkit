import React from 'react';
import { AggregatedFinding } from '../types';
import { AssetIndex, AssetModel, RESOURCE_OBSERVATION_LABELS } from '../logic/report/assetModel';
import { AssetGraph, GraphNode, relatedNodeIds } from '../logic/report/graph';
import {
  DOMAIN_KIND_LABELS,
  FOCUS_RING,
  ISSUE_LEVEL_LABELS,
  RELATIONSHIP_LABELS,
  RESOURCE_TYPE_LABELS,
  pluralize
} from './presentation';

export interface AssetGraphDetailsProps {
  node: GraphNode | null;
  graph: AssetGraph;
  model: AssetModel;
  index: AssetIndex;
  findingsById: ReadonlyMap<string, AggregatedFinding>;
  onSelectNode: (nodeId: string) => void;
  onShowResource: (resourceId: string) => void;
  onShowDomainResources: (host: string) => void;
  onShowFinding: (findingId: string) => void;
}

const linkButton = `text-left text-xs text-emerald-400 hover:text-emerald-300 underline underline-offset-2 break-all ${FOCUS_RING}`;

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="grid grid-cols-[7rem_1fr] gap-2 text-xs">
    <dt className="text-slate-500">{label}</dt>
    <dd className="text-slate-300 break-all min-w-0">{children}</dd>
  </div>
);

/** Details for the selected node. Everything target-derived is rendered as text. */
export const AssetGraphDetails: React.FC<AssetGraphDetailsProps> = ({
  node,
  graph,
  model,
  index,
  findingsById,
  onSelectNode,
  onShowResource,
  onShowDomainResources,
  onShowFinding
}) => {
  if (!node) return null;

  const related = relatedNodeIds(graph, node.id);
  const nodeById = new Map(graph.nodes.map((candidate) => [candidate.id, candidate]));
  const relatedOf = (type: GraphNode['type']) =>
    related.map((id) => nodeById.get(id)).filter((n): n is GraphNode => !!n && n.type === type);

  const resource = node.type === 'resource' ? index.resourceById.get(node.id) : undefined;
  const domain = node.type === 'domain' ? index.domainById.get(node.id) : undefined;
  const page = node.type === 'page' ? index.pageById.get(node.id) : undefined;
  const findingIds = node.findingIds;

  const nodeLinks = (nodes: GraphNode[], limit = 12) => (
    <ul className="space-y-1">
      {nodes.slice(0, limit).map((item) => (
        <li key={item.id}>
          <button type="button" onClick={() => onSelectNode(item.id)} className={linkButton}>
            {item.title}
          </button>
        </li>
      ))}
      {nodes.length > limit && <li className="text-[11px] text-slate-500">and {nodes.length - limit} more</li>}
    </ul>
  );

  return (
    <div className="space-y-3" aria-live="polite">
      <div>
        <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
          {node.type === 'domain' ? 'External domain' : node.type === 'target' ? 'Target' : node.type}
        </span>
        <p className="text-sm font-semibold text-white break-all">{node.title}</p>
      </div>

      <dl className="space-y-1.5">
        {node.type === 'target' && (
          <Row label="Pages">{model.stats.pagesCrawled} analyzed</Row>
        )}

        {page && (
          <>
            <Row label="Depth">{page.depth}</Row>
            <Row label="Resources">{page.resourceIds.length} referenced</Row>
          </>
        )}

        {resource && (
          <>
            <Row label="Type">{RESOURCE_TYPE_LABELS[resource.type]}</Row>
            <Row label="Origin">{resource.origin ?? '—'}</Row>
            <Row label="Party">{RELATIONSHIP_LABELS[resource.relationship]}</Row>
            <Row label="Integrity hash">{resource.integrity}</Row>
            <Row label="crossorigin">{resource.crossOrigin}</Row>
            <Row label="References">{resource.referenceCount}</Row>
          </>
        )}

        {domain && (
          <>
            <Row label="Party">{RELATIONSHIP_LABELS[domain.relationship]}</Row>
            <Row label="Kind">{DOMAIN_KIND_LABELS[domain.kind]}</Row>
            <Row label="Resources">{domain.resourceCount}</Row>
            <Row label="Pages">{domain.pageIds.length}</Row>
            <Row label="Scheme">{domain.usesHttp ? 'Includes plaintext HTTP' : domain.protocols.join(', ') || '—'}</Row>
          </>
        )}

        <Row label="Status">{ISSUE_LEVEL_LABELS[node.issueLevel]}</Row>
      </dl>

      {resource && resource.observations.length > 0 && (
        <ul className="list-disc pl-4 text-xs text-amber-300 space-y-0.5">
          {resource.observations.map((observation) => (
            <li key={observation}>{RESOURCE_OBSERVATION_LABELS[observation]}</li>
          ))}
        </ul>
      )}

      {(node.type === 'resource' || node.type === 'domain') && relatedOf('page').length > 0 && (
        <div className="space-y-1">
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
            {node.type === 'domain' ? 'Pages that depend on it' : 'Referenced by'}
          </span>
          {nodeLinks(relatedOf('page'))}
        </div>
      )}

      {(node.type === 'page' || node.type === 'domain') && relatedOf('resource').length > 0 && (
        <div className="space-y-1">
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
            {relatedOf('resource').length} {pluralize(relatedOf('resource').length, 'resource')} shown
          </span>
          {nodeLinks(relatedOf('resource'))}
        </div>
      )}

      {node.type === 'resource' && relatedOf('domain').length > 0 && (
        <div className="space-y-1">
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">Hosted on</span>
          {nodeLinks(relatedOf('domain'))}
        </div>
      )}

      {findingIds.length > 0 && (
        <div className="space-y-1">
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
            {findingIds.length} {pluralize(findingIds.length, 'finding')} {node.type === 'domain' ? 'involve this domain' : 'affect this'}
          </span>
          <ul className="space-y-1">
            {findingIds.map((id) => {
              const finding = findingsById.get(id);
              if (!finding) return null;
              return (
                <li key={id}>
                  <button type="button" onClick={() => onShowFinding(id)} className={linkButton}>
                    {finding.title}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {resource && (
          <button type="button" onClick={() => onShowResource(resource.id)} className={`px-2 py-1 rounded border border-slate-700 text-[11px] font-mono text-slate-300 hover:text-white ${FOCUS_RING}`}>
            Show in inventory
          </button>
        )}
        {domain && (
          <button type="button" onClick={() => onShowDomainResources(domain.host)} className={`px-2 py-1 rounded border border-slate-700 text-[11px] font-mono text-slate-300 hover:text-white ${FOCUS_RING}`}>
            Show resources in inventory
          </button>
        )}
      </div>
    </div>
  );
};
