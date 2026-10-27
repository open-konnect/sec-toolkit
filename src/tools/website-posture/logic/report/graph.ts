/**
 * Asset map graph model.
 *
 * Builds nodes and edges from the asset model — deduplicated, with stable ids,
 * and bounded so a large site cannot freeze the page. This module knows
 * nothing about Cytoscape or React; it produces plain data that the graph
 * component hands to the renderer.
 *
 * Labels are shortened, sanitized text. Nothing here is markup, and the
 * renderer draws labels on a canvas rather than into the DOM.
 */

import {
  AssetModel,
  AssetResource,
  IssueLevel,
  ResourceTypeGroup
} from './assetModel';
import { safeText, shortLabel } from './text';
import { PartyRelationship, ResourceType, ThirdPartyKind } from '../../types';

export const GRAPH_LIMITS = {
  /** Above this the full graph is replaced by a reduced one. */
  maxNodes: 400,
  maxEdges: 1200
} as const;

export type GraphNodeType = 'target' | 'page' | 'resource' | 'domain';
export type GraphEdgeKind = 'contains' | 'links-to' | 'loads' | 'hosted-on';

export interface GraphNode {
  id: string;
  type: GraphNodeType;
  /** Short, sanitized text drawn on the node. */
  label: string;
  /** Full sanitized text for lists and details. */
  title: string;
  url?: string;
  host?: string;
  resourceType?: ResourceType;
  group?: ResourceTypeGroup;
  relationship?: PartyRelationship;
  domainKind?: ThirdPartyKind;
  issueLevel: IssueLevel;
  /** True when the node carries a notable observation, such as plaintext HTTP. */
  notable: boolean;
  findingIds: string[];
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  kind: GraphEdgeKind;
}

export type GraphStatus = 'ok' | 'degraded' | 'too-large' | 'empty';

export interface GraphFilters {
  /** Null shows every resource type. */
  groups: ReadonlySet<ResourceTypeGroup> | null;
  party: 'all' | 'first-party' | 'external' | 'third-party';
  /** Show only resources with findings or notable observations. */
  onlyAttention: boolean;
}

export const DEFAULT_GRAPH_FILTERS: GraphFilters = {
  groups: null,
  party: 'all',
  onlyAttention: false
};

export interface AssetGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  status: GraphStatus;
  /** Size of the filtered graph before any reduction. */
  totals: { nodes: number; edges: number };
  /** Resource nodes left out by the reduction. */
  omittedResources: number;
}

export const TARGET_NODE_ID = 'target';

function visibleResource(resource: AssetResource, filters: GraphFilters): boolean {
  if (filters.groups && !filters.groups.has(resource.group)) return false;
  switch (filters.party) {
    case 'first-party':
      if (resource.relationship !== 'first-party') return false;
      break;
    case 'external':
      if (resource.relationship === 'first-party') return false;
      break;
    case 'third-party':
      if (resource.relationship !== 'third-party') return false;
      break;
    case 'all':
      break;
  }
  if (filters.onlyAttention && resource.findingIds.length === 0 && resource.observations.length === 0) {
    return false;
  }
  return true;
}

function edgeId(source: string, target: string, kind: GraphEdgeKind): string {
  return `${source}>${target}:${kind}`;
}

interface Assembly {
  nodes: Map<string, GraphNode>;
  edges: Map<string, GraphEdge>;
}

function addEdge(assembly: Assembly, source: string, target: string, kind: GraphEdgeKind): void {
  const id = edgeId(source, target, kind);
  if (!assembly.edges.has(id)) assembly.edges.set(id, { id, source, target, kind });
}

function assemble(model: AssetModel, resources: readonly AssetResource[]): Assembly {
  const assembly: Assembly = { nodes: new Map(), edges: new Map() };
  const { nodes } = assembly;

  nodes.set(TARGET_NODE_ID, {
    id: TARGET_NODE_ID,
    type: 'target',
    label: shortLabel(model.target.host, 28),
    title: safeText(model.target.url, 300),
    url: model.target.url,
    host: model.target.host,
    issueLevel: 'none',
    notable: false,
    findingIds: []
  });

  for (const page of model.pages) {
    nodes.set(page.id, {
      id: page.id,
      type: 'page',
      label: shortLabel(page.url, 30),
      title: page.title ? `${page.title} — ${page.url}` : page.url,
      url: page.url,
      issueLevel: page.issueLevel,
      notable: false,
      findingIds: page.findingIds
    });
  }

  // The entry page hangs off the target; other pages hang off the page that
  // links to them. Any page nothing links to is attached to the target so the
  // graph stays connected.
  const linkedTo = new Set<string>();
  for (const page of model.pages) {
    for (const other of page.linkedPageIds) {
      // One edge per unordered pair keeps mutual links from doubling up.
      if (!assembly.edges.has(edgeId(other, page.id, 'links-to'))) {
        addEdge(assembly, page.id, other, 'links-to');
      }
      linkedTo.add(other);
    }
  }
  for (const page of model.pages) {
    if (page.depth === 0 || !linkedTo.has(page.id)) addEdge(assembly, TARGET_NODE_ID, page.id, 'contains');
  }

  const domainById = new Map(model.domains.map((domain) => [domain.host, domain]));
  const usedDomains = new Set<string>();

  for (const resource of resources) {
    nodes.set(resource.id, {
      id: resource.id,
      type: 'resource',
      label: shortLabel(resource.url, 28),
      title: resource.url,
      url: resource.url,
      host: resource.host ?? undefined,
      resourceType: resource.type,
      group: resource.group,
      relationship: resource.relationship,
      issueLevel: resource.issueLevel,
      notable: resource.observations.length > 0,
      findingIds: resource.findingIds
    });

    for (const pageId of resource.pageIds) addEdge(assembly, pageId, resource.id, 'loads');

    const domain = resource.host ? domainById.get(resource.host) : undefined;
    if (domain && resource.relationship !== 'first-party') {
      usedDomains.add(domain.host);
      addEdge(assembly, resource.id, domain.id, 'hosted-on');
    }
  }

  for (const domain of model.domains) {
    if (!usedDomains.has(domain.host)) continue;
    nodes.set(domain.id, {
      id: domain.id,
      type: 'domain',
      label: shortLabel(domain.host, 28),
      title: domain.host,
      host: domain.host,
      relationship: domain.relationship,
      domainKind: domain.kind,
      issueLevel: domain.issueLevel,
      notable: domain.usesHttp,
      findingIds: domain.findingIds
    });
  }

  return assembly;
}

function fits(assembly: Assembly): boolean {
  return assembly.nodes.size <= GRAPH_LIMITS.maxNodes && assembly.edges.size <= GRAPH_LIMITS.maxEdges;
}

/**
 * Builds the graph for the current filters.
 *
 * If the filtered graph is too big it is first reduced to what matters for
 * exposure — external resources and anything with a finding or observation —
 * and, if that is still too big, no elements are returned and the caller shows
 * a message. The inventory table stays the authoritative detail view either way.
 */
export function buildAssetGraph(
  model: AssetModel,
  filters: GraphFilters = DEFAULT_GRAPH_FILTERS
): AssetGraph {
  const candidates = model.resources.filter((resource) => visibleResource(resource, filters));
  const full = assemble(model, candidates);
  const totals = { nodes: full.nodes.size, edges: full.edges.size };

  if (model.pages.length === 0 && model.resources.length === 0) {
    return { nodes: [], edges: [], status: 'empty', totals: { nodes: 0, edges: 0 }, omittedResources: 0 };
  }

  if (fits(full)) {
    return {
      nodes: [...full.nodes.values()],
      edges: [...full.edges.values()],
      status: 'ok',
      totals,
      omittedResources: 0
    };
  }

  const reduced = candidates.filter(
    (resource) =>
      resource.relationship !== 'first-party' ||
      resource.findingIds.length > 0 ||
      resource.observations.length > 0
  );
  const reducedAssembly = assemble(model, reduced);

  if (fits(reducedAssembly)) {
    return {
      nodes: [...reducedAssembly.nodes.values()],
      edges: [...reducedAssembly.edges.values()],
      status: 'degraded',
      totals,
      omittedResources: candidates.length - reduced.length
    };
  }

  return {
    nodes: [],
    edges: [],
    status: 'too-large',
    totals,
    omittedResources: candidates.length
  };
}

/** Ids of nodes whose label, title, URL or host contains every search term. */
export function searchGraphNodes(graph: AssetGraph, query: string): string[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [];
  return graph.nodes
    .filter((node) => {
      const text = `${node.label} ${node.title} ${node.url ?? ''} ${node.host ?? ''}`.toLowerCase();
      return terms.every((term) => text.includes(term));
    })
    .map((node) => node.id);
}

/**
 * Nodes reachable from `nodeId`, ignoring edge direction. A domain reaches two
 * hops (its resources, then the pages that load them); everything else one.
 */
export function relatedNodeIds(graph: AssetGraph, nodeId: string): string[] {
  const node = graph.nodes.find((candidate) => candidate.id === nodeId);
  if (!node) return [];
  const depth = node.type === 'domain' ? 2 : 1;

  const adjacency = new Map<string, Set<string>>();
  for (const edge of graph.edges) {
    (adjacency.get(edge.source) ?? adjacency.set(edge.source, new Set()).get(edge.source))!.add(edge.target);
    (adjacency.get(edge.target) ?? adjacency.set(edge.target, new Set()).get(edge.target))!.add(edge.source);
  }

  const seen = new Set<string>([nodeId]);
  let frontier = [nodeId];
  for (let step = 0; step < depth; step += 1) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const neighbour of adjacency.get(id) ?? []) {
        if (seen.has(neighbour)) continue;
        // The target node touches every page, so the walk does not continue through it.
        seen.add(neighbour);
        if (neighbour !== TARGET_NODE_ID) next.push(neighbour);
      }
    }
    frontier = next;
  }
  seen.delete(nodeId);
  return [...seen];
}
