/**
 * Presentation mapping for assessment results.
 *
 * Kept separate from `logic/` so the engine stays framework-free, and separate
 * from the components so the wording of every status label lives in one place.
 * The wording here is deliberately conservative: nothing in this file may claim
 * that a target is secure or free of vulnerabilities.
 */

import { BadgeVariant } from '../../../components/ui/Badge';
import {
  FindingCategory,
  PartyRelationship,
  ResourceType,
  ThirdPartyKind,
  FindingStatus,
  ObservationKind,
  ScoreGrade,
  Severity
} from '../types';

export const STATUS_LABELS: Record<FindingStatus, string> = {
  fail: 'Issue detected',
  warning: 'Worth reviewing',
  pass: 'No issue detected',
  info: 'Informational',
  'unable-to-verify': 'Unable to verify',
  'not-applicable': 'Not applicable'
};

export const STATUS_BADGES: Record<FindingStatus, BadgeVariant> = {
  fail: 'critical',
  warning: 'medium',
  pass: 'success',
  info: 'info',
  'unable-to-verify': 'outline',
  'not-applicable': 'outline'
};

export const SEVERITY_LABELS: Record<Severity, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
  informational: 'Informational'
};

export const SEVERITY_BADGES: Record<Severity, BadgeVariant> = {
  critical: 'critical',
  high: 'high',
  medium: 'medium',
  low: 'low',
  informational: 'info'
};

/** The epistemic class of a finding, spelled out for the reader. */
export const OBSERVATION_LABELS: Record<ObservationKind, string> = {
  'verified-observation': 'Verified observation',
  'best-practice': 'Hardening suggestion',
  'potential-concern': 'Potential concern',
  'unable-to-verify': 'Unable to verify',
  'not-applicable': 'Not applicable'
};

export const OBSERVATION_HINTS: Record<ObservationKind, string> = {
  'verified-observation': 'Directly observed in data this assessment could actually read.',
  'best-practice':
    'A hardening recommendation, not a confirmed weakness. It does not mean the site is exploitable.',
  'potential-concern': 'Suggestive but not conclusive. Confirm it yourself before acting.',
  'unable-to-verify':
    'A browser security boundary blocked this check. It is not a finding about the target.',
  'not-applicable': 'The precondition for this check does not exist on the pages analyzed.'
};

export const CATEGORY_LABELS: Record<FindingCategory, string> = {
  transport: 'Transport security',
  'content-security-policy': 'Content Security Policy',
  'resource-integrity': 'Resource integrity',
  'response-headers': 'Response headers',
  'forms-and-input': 'Forms and input',
  'information-disclosure': 'Information disclosure',
  'third-party': 'Third-party content',
  'browser-storage': 'Browser storage',
  'script-security': 'Scripts and DOM',
  framing: 'Framing and iframes',
  'links-and-navigation': 'Links and navigation',
  'service-workers': 'Service workers',
  'browser-permissions': 'Browser permissions',
  'authentication-surface': 'Authentication surface',
  'disclosure-process': 'Disclosure process',
  'site-metadata': 'Site metadata',
  correlation: 'Cross-check correlation'
};

export const GRADE_COLORS: Record<ScoreGrade, string> = {
  A: 'text-emerald-400',
  B: 'text-emerald-300',
  C: 'text-amber-300',
  D: 'text-orange-300',
  F: 'text-rose-300'
};

/** Order findings are grouped under in the report. */
export const STATUS_SECTIONS: readonly FindingStatus[] = [
  'fail',
  'warning',
  'info',
  'pass',
  'unable-to-verify',
  'not-applicable'
];

export function scoreColor(value: number | null): string {
  if (value === null) return 'text-slate-300';
  if (value >= 80) return 'text-emerald-400';
  if (value >= 60) return 'text-amber-300';
  return 'text-rose-300';
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return count === 1 ? singular : plural;
}

export const RELATIONSHIP_LABELS: Record<PartyRelationship, string> = {
  'first-party': 'First-party',
  'same-site': 'Same-site',
  'third-party': 'Third-party'
};

export const RELATIONSHIP_HINTS: Record<PartyRelationship, string> = {
  'first-party': 'Same origin as the page that references it.',
  'same-site': 'A different origin under the same registrable domain, such as a cdn. subdomain.',
  'third-party': 'A different registrable domain.'
};

export const RESOURCE_TYPE_LABELS: Record<ResourceType, string> = {
  script: 'Script',
  stylesheet: 'Stylesheet',
  image: 'Image',
  font: 'Font',
  iframe: 'Iframe',
  media: 'Media',
  embed: 'Embed',
  object: 'Object',
  manifest: 'Manifest',
  preload: 'Preload',
  link: 'Link',
  other: 'Other'
};

/**
 * Labels for a host's apparent role. They come from a built-in list of
 * well-known hostnames only; the service itself is never inspected.
 */
export const DOMAIN_KIND_LABELS: Record<ThirdPartyKind, string> = {
  cdn: 'Known CDN or static host',
  analytics: 'Known analytics host',
  payment: 'Known payment host',
  'tag-manager': 'Known tag-manager host',
  social: 'Known social host',
  other: 'Not in the known-host list'
};

export const ISSUE_LEVEL_LABELS = {
  none: 'No findings',
  info: 'Informational',
  warning: 'Worth reviewing',
  fail: 'Issue detected'
} as const;

/** Shared keyboard-focus ring for interactive elements in the report. */
export const FOCUS_RING =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-950';

/** Text shown next to a status so it is never conveyed by color alone. */
export const STATUS_MARKS: Record<FindingStatus, string> = {
  fail: '✕',
  warning: '!',
  pass: '✓',
  info: 'i',
  'unable-to-verify': '?',
  'not-applicable': '–'
};
