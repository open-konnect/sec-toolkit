import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Core, ElementDefinition } from 'cytoscape';
import { Maximize2, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import { AggregatedFinding } from '../types';
import {
  AssetIndex,
  AssetModel,
  RESOURCE_GROUP_LABELS,
  ResourceTypeGroup
} from '../logic/report/assetModel';
import {
  AssetGraph as AssetGraphData,
  DEFAULT_GRAPH_FILTERS,
  GRAPH_LIMITS,
  GraphFilters,
  GraphNode,
  buildAssetGraph,
  relatedNodeIds,
  searchGraphNodes
} from '../logic/report/graph';
import { AssetGraphDetails } from './AssetGraphDetails';
import { FOCUS_RING, pluralize } from './presentation';

const GROUPS = Object.keys(RESOURCE_GROUP_LABELS) as ResourceTypeGroup[];

const NODE_STYLE: Record<GraphNode['type'], { shape: string; color: string; size: number }> = {
  target: { shape: 'diamond', color: '#34d399', size: 34 },
  page: { shape: 'round-rectangle', color: '#38bdf8', size: 24 },
  resource: { shape: 'ellipse', color: '#94a3b8', size: 14 },
  domain: { shape: 'hexagon', color: '#fbbf24', size: 26 }
};

const TYPE_LABEL: Record<GraphNode['type'], string> = {
  target: 'Target',
  page: 'Pages',
  resource: 'Resources',
  domain: 'External domains'
};

function toElements(graph: AssetGraphData): ElementDefinition[] {
  const nodes: ElementDefinition[] = graph.nodes.map((node) => ({
    group: 'nodes',
    // Labels are plain strings; Cytoscape draws them on a canvas, never as markup.
    data: {
      id: node.id,
      label: node.label,
      type: node.type,
      issue: node.issueLevel,
      notable: node.notable ? 1 : 0
    }
  }));
  const edges: ElementDefinition[] = graph.edges.map((edge) => ({
    group: 'edges',
    data: { id: edge.id, source: edge.source, target: edge.target, kind: edge.kind }
  }));
  return [...nodes, ...edges];
}

function buildStyle() {
  const base = [
    {
      selector: 'node',
      style: {
        label: 'data(label)',
        color: '#e2e8f0',
        'font-size': 9,
        'text-valign': 'bottom',
        'text-margin-y': 3,
        'min-zoomed-font-size': 8,
        'border-width': 1,
        'border-color': '#0f172a'
      }
    },
    {
      selector: 'edge',
      style: {
        width: 1,
        'line-color': '#475569',
        'target-arrow-color': '#475569',
        'target-arrow-shape': 'triangle',
        'arrow-scale': 0.6,
        'curve-style': 'haircut'
      }
    },
    // Issue level is shown by border style as well as color.
    { selector: 'node[issue = "warning"]', style: { 'border-width': 3, 'border-style': 'dashed', 'border-color': '#fbbf24' } },
    { selector: 'node[issue = "fail"]', style: { 'border-width': 4, 'border-style': 'double', 'border-color': '#fb7185' } },
    { selector: 'node[issue = "info"]', style: { 'border-width': 2, 'border-style': 'dotted', 'border-color': '#38bdf8' } },
    { selector: 'node[notable = 1]', style: { 'underlay-color': '#fb923c', 'underlay-opacity': 0.35, 'underlay-padding': 4 } },
    { selector: '.dim', style: { opacity: 0.15 } },
    { selector: '.match', style: { 'border-width': 4, 'border-style': 'solid', 'border-color': '#ffffff' } },
    { selector: ':selected, .selected', style: { 'border-width': 4, 'border-style': 'solid', 'border-color': '#ffffff' } }
  ];
  const perType = (Object.keys(NODE_STYLE) as GraphNode['type'][]).map((type) => ({
    selector: `node[type = "${type}"]`,
    style: {
      shape: NODE_STYLE[type].shape,
      'background-color': NODE_STYLE[type].color,
      width: NODE_STYLE[type].size,
      height: NODE_STYLE[type].size
    }
  }));
  return [...base.slice(0, 2), ...perType, ...base.slice(2)];
}

export interface AssetGraphProps {
  model: AssetModel;
  index: AssetIndex;
  findingsById: ReadonlyMap<string, AggregatedFinding>;
  /** Node the rest of the report asked to reveal. `nonce` re-triggers the same id. */
  focus: { nodeId: string; nonce: number } | null;
  onShowResource: (resourceId: string) => void;
  onShowDomainResources: (host: string) => void;
  onShowFinding: (findingId: string) => void;
}

/**
 * Interactive asset map. Cytoscape is imported on demand, only once the section
 * scrolls into view, and one instance lives for the lifetime of the component.
 * The graph only visualizes data already in the report; it fetches nothing.
 */
export const AssetGraph: React.FC<AssetGraphProps> = ({
  model,
  index,
  findingsById,
  focus,
  onShowResource,
  onShowDomainResources,
  onShowFinding
}) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);
  const onSelectRef = useRef<(id: string | null) => void>(() => undefined);

  const [visible, setVisible] = useState(false);
  const [engine, setEngine] = useState<'idle' | 'loading' | 'ready' | 'failed'>('idle');
  const [filters, setFilters] = useState<GraphFilters>(DEFAULT_GRAPH_FILTERS);
  const [query, setQuery] = useState('');
  const [attentionOnly, setAttentionOnly] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  onSelectRef.current = setSelectedId;

  const graph = useMemo(() => buildAssetGraph(model, filters), [model, filters]);
  const nodeById = useMemo(() => new Map(graph.nodes.map((node) => [node.id, node])), [graph]);
  const selectedNode = selectedId ? (nodeById.get(selectedId) ?? null) : null;
  const matches = useMemo(() => new Set(searchGraphNodes(graph, query)), [graph, query]);
  const hasElements = graph.nodes.length > 0;

  /* Lazy init: wait until the section is on screen. */
  useEffect(() => {
    const element = wrapperRef.current;
    if (!element) return;
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setVisible(true);
        observer.disconnect();
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  /* Create the instance once. */
  useEffect(() => {
    if (!visible || cyRef.current || !hasElements) return;
    let cancelled = false;
    setEngine('loading');
    import('cytoscape')
      .then((module) => {
        if (cancelled || !containerRef.current) return;
        const cytoscape = module.default;
        const cy = cytoscape({
          container: containerRef.current,
          elements: [],
          style: buildStyle() as never,
          minZoom: 0.1,
          maxZoom: 3,
          wheelSensitivity: 0.3,
          boxSelectionEnabled: false,
          autoungrabify: false
        });
        cy.on('tap', 'node', (event) => onSelectRef.current(event.target.id()));
        cy.on('tap', (event) => {
          if (event.target === cy) onSelectRef.current(null);
        });
        cyRef.current = cy;
        setEngine('ready');
      })
      .catch(() => {
        if (!cancelled) setEngine('failed');
      });
    return () => {
      cancelled = true;
    };
  }, [visible, hasElements]);

  useEffect(
    () => () => {
      cyRef.current?.destroy();
      cyRef.current = null;
    },
    []
  );

  /* Swap elements when the filtered graph changes; the instance is reused. */
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy || engine !== 'ready') return;
    cy.batch(() => {
      cy.elements().remove();
      cy.add(toElements(graph));
    });
    if (graph.nodes.length > 0) {
      cy.layout({
        name: 'breadthfirst',
        roots: ['#target'],
        directed: true,
        // Rings keep the hierarchy (target, pages, resources, domains) readable
        // instead of stretching every resource into one wide row.
        circle: true,
        avoidOverlap: true,
        spacingFactor: 1.2,
        animate: false,
        fit: true,
        padding: 24
      }).run();
    }
  }, [graph, engine]);

  /* Selection, search and attention emphasis. */
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy || engine !== 'ready') return;
    cy.batch(() => {
      cy.elements().removeClass('dim match selected');
      const keep = new Set<string>();
      if (selectedId && nodeById.has(selectedId)) {
        keep.add(selectedId);
        for (const id of relatedNodeIds(graph, selectedId)) keep.add(id);
        cy.getElementById(selectedId).addClass('selected');
      }
      if (matches.size > 0) {
        for (const id of matches) {
          keep.add(id);
          cy.getElementById(id).addClass('match');
        }
      }
      if (attentionOnly) {
        for (const node of graph.nodes) {
          if (node.issueLevel !== 'none' || node.notable) keep.add(node.id);
        }
      }
      if (keep.size > 0) {
        cy.nodes().filter((node) => !keep.has(node.id())).addClass('dim');
        cy.edges().filter((edge) => !keep.has(edge.source().id()) || !keep.has(edge.target().id())).addClass('dim');
      }
    });
  }, [selectedId, matches, attentionOnly, graph, nodeById, engine]);

  /* Reveal a node requested by another section. */
  useEffect(() => {
    if (!focus) return;
    setFilters(DEFAULT_GRAPH_FILTERS);
    setQuery('');
    setSelectedId(focus.nodeId);
    wrapperRef.current?.scrollIntoView?.({ block: 'start' });
  }, [focus]);

  const zoomBy = useCallback((factor: number) => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.zoom({
      level: cy.zoom() * factor,
      renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 }
    });
  }, []);

  const fit = useCallback(() => cyRef.current?.fit(undefined, 24), []);

  const reset = useCallback(() => {
    setFilters(DEFAULT_GRAPH_FILTERS);
    setQuery('');
    setAttentionOnly(false);
    setSelectedId(null);
    cyRef.current?.fit(undefined, 24);
  }, []);

  const toggleGroup = (group: ResourceTypeGroup) =>
    setFilters((previous) => {
      const current = previous.groups ?? new Set<ResourceTypeGroup>(GROUPS);
      const next = new Set(current);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return { ...previous, groups: next.size === GROUPS.length ? null : next };
    });

  const buttonClass = `inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-slate-700 bg-slate-950 text-xs font-mono text-slate-300 hover:text-white ${FOCUS_RING}`;

  return (
    <section aria-labelledby="map-title" className="space-y-3" ref={wrapperRef}>
      <div className="space-y-1">
        <h3 id="map-title" className="text-sm font-bold text-white tracking-tight">
          Asset map
        </h3>
        <p className="text-xs text-slate-500 leading-relaxed">
          An optional view of how the target, its pages, the resources they reference and the external
          domains hosting them connect. It is drawn locally from the inventory above, which remains the
          complete record.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label htmlFor="graph-search" className="text-xs font-mono text-slate-400">Find in map</label>
          <input
            id="graph-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            autoComplete="off"
            spellCheck={false}
            className={`px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-950 font-mono text-xs text-slate-200 focus:border-emerald-500 ${FOCUS_RING}`}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="graph-party" className="text-xs font-mono text-slate-400">Party</label>
          <select
            id="graph-party"
            value={filters.party}
            onChange={(event) => setFilters((previous) => ({ ...previous, party: event.target.value as GraphFilters['party'] }))}
            className={`px-2 py-1.5 rounded-lg border border-slate-800 bg-slate-950 text-xs text-slate-200 ${FOCUS_RING}`}
          >
            <option value="all">All</option>
            <option value="first-party">First-party only</option>
            <option value="external">All external</option>
            <option value="third-party">Third-party only</option>
          </select>
        </div>
        <label className="inline-flex items-center gap-2 text-xs font-mono text-slate-300 pb-1.5">
          <input
            type="checkbox"
            checked={attentionOnly}
            onChange={(event) => setAttentionOnly(event.target.checked)}
            className="accent-emerald-500"
          />
          Highlight security-relevant
        </label>
      </div>

      <div role="group" aria-label="Resource types shown in the map" className="flex flex-wrap gap-1.5">
        {GROUPS.map((group) => {
          const on = !filters.groups || filters.groups.has(group);
          return (
            <button
              key={group}
              type="button"
              aria-pressed={on}
              onClick={() => toggleGroup(group)}
              className={`px-2.5 py-1 rounded-md border text-xs font-mono ${FOCUS_RING} ${
                on ? 'bg-slate-800 border-emerald-600 text-emerald-300' : 'bg-slate-950 border-slate-800 text-slate-500'
              }`}
            >
              {RESOURCE_GROUP_LABELS[group]}
            </button>
          );
        })}
      </div>

      {graph.status === 'degraded' && (
        <p role="status" className="text-xs text-amber-300">
          This site has too many resources to draw them all. The map shows external resources and anything
          with a finding; {graph.omittedResources} other {pluralize(graph.omittedResources, 'resource')} are
          left out. The inventory table lists everything.
        </p>
      )}
      {graph.status === 'too-large' && (
        <p role="status" className="text-xs text-amber-300">
          The map is too large to draw usefully ({graph.totals.nodes} nodes; the limit is {GRAPH_LIMITS.maxNodes}).
          Narrow it with the type or party filters, or use the inventory table.
        </p>
      )}
      {graph.status === 'empty' && (
        <p role="status" className="text-xs text-slate-400">Nothing to map: no pages or resources were read.</p>
      )}
      {engine === 'failed' && (
        <p role="status" className="text-xs text-amber-300">
          The map could not be loaded in this browser. Everything on it is available in the inventory and
          the node list below.
        </p>
      )}

      <div
        className={`grid grid-cols-1 gap-4 ${selectedNode ? 'lg:grid-cols-[1fr_20rem]' : ''}`}
      >
        <div className="space-y-2 min-w-0">
          <div className="relative rounded-xl border border-slate-800 bg-slate-950 overflow-hidden">
            <div
              ref={containerRef}
              role="img"
              aria-label={`Asset map with ${graph.nodes.length} nodes and ${graph.edges.length} connections. A keyboard-accessible node list follows the map.`}
              className={`h-[26rem] w-full ${hasElements && engine !== 'failed' ? '' : 'hidden'}`}
            />
            {hasElements && engine !== 'ready' && engine !== 'failed' && (
              <p className="absolute inset-0 flex items-center justify-center text-xs font-mono text-slate-500">
                {visible ? 'Loading map…' : 'Map loads when this section is in view'}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => zoomBy(1.3)} className={buttonClass} aria-label="Zoom in">
              <ZoomIn className="w-3.5 h-3.5" aria-hidden="true" /> Zoom in
            </button>
            <button type="button" onClick={() => zoomBy(1 / 1.3)} className={buttonClass} aria-label="Zoom out">
              <ZoomOut className="w-3.5 h-3.5" aria-hidden="true" /> Zoom out
            </button>
            <button type="button" onClick={fit} className={buttonClass}>
              <Maximize2 className="w-3.5 h-3.5" aria-hidden="true" /> Fit
            </button>
            <button type="button" onClick={reset} className={buttonClass}>
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" /> Reset
            </button>
          </div>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-400" aria-label="Map legend">
            <li>◆ Target</li>
            <li>▭ Page</li>
            <li>● Resource</li>
            <li>⬡ External domain</li>
            <li>Dashed border: worth reviewing</li>
            <li>Double border: issue detected</li>
          </ul>
        </div>

        {selectedNode && (
        <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/40">
          <AssetGraphDetails
            node={selectedNode}
            graph={graph}
            model={model}
            index={index}
            findingsById={findingsById}
            onSelectNode={setSelectedId}
            onShowResource={onShowResource}
            onShowDomainResources={onShowDomainResources}
            onShowFinding={onShowFinding}
          />
        </div>
        )}
      </div>

      {hasElements && (
        <details className="rounded-xl border border-slate-800 bg-slate-900/30">
          <summary className={`cursor-pointer p-3 text-xs font-mono text-slate-300 ${FOCUS_RING}`}>
            Node list ({graph.nodes.length}) — keyboard-accessible alternative to the map
          </summary>
          <div className="p-3 pt-0 space-y-3 max-h-80 overflow-y-auto">
            {(['target', 'page', 'domain', 'resource'] as const).map((type) => {
              const nodes = graph.nodes.filter((node) => node.type === type);
              if (nodes.length === 0) return null;
              return (
                <div key={type} className="space-y-1">
                  <h4 className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
                    {TYPE_LABEL[type]} ({nodes.length})
                  </h4>
                  <ul className="space-y-0.5">
                    {nodes.map((node) => (
                      <li key={node.id}>
                        <button
                          type="button"
                          aria-pressed={node.id === selectedId}
                          onClick={() => setSelectedId(node.id)}
                          className={`w-full text-left px-2 py-1 rounded font-mono text-[11px] break-all ${FOCUS_RING} ${
                            node.id === selectedId ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          {node.title}
                          {node.issueLevel !== 'none' && (
                            <span className="ml-2 text-amber-300">[{node.issueLevel}]</span>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </details>
      )}
    </section>
  );
};
