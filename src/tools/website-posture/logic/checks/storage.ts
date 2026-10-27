/**
 * Browser storage and service worker indicators.
 *
 * Both are derived from markers seen in inline script. The engine never reads
 * a stored value — it cannot, since storage belongs to the target's origin and
 * not to this page — and it never registers, updates, or unregisters a worker.
 *
 * Neither storage nor a service worker is a weakness. localStorage is not
 * "insecure"; it is readable by any script running on the origin, which only
 * matters in proportion to what is kept there. The report says that, and says
 * nothing about what this site actually keeps there, because it does not know.
 */

import { AnalyzedPage, CheckContext, CheckOutcome, SecurityCheck, SecurityFinding } from '../../types';
import { createFinding, notApplicable } from '../findings';

/** Pages whose inline script mentioned any storage API. */
function pagesUsingStorage(pages: readonly AnalyzedPage[]): AnalyzedPage[] {
  return pages.filter((page) => page.storageIndicators.length > 0);
}

/** The union of storage markers across pages, in stable order. */
function mergedLabels(pages: readonly AnalyzedPage[], pick: (page: AnalyzedPage) => string[]): string[] {
  const labels = new Set<string>();
  for (const page of pages) for (const label of pick(page)) labels.add(label);
  return [...labels].sort();
}

/* -------------------------------------------------------------------------- */
/* Browser storage                                                            */
/* -------------------------------------------------------------------------- */

export const browserStorageCheck: SecurityCheck = {
  id: 'browser-storage-usage',
  category: 'browser-storage',
  name: 'Browser storage usage',
  description:
    'Notes use of localStorage, sessionStorage, IndexedDB, Cache Storage, and document.cookie, without reading any stored value.',
  severity: 'low',
  scoreWeight: 4,
  modes: ['browser-passive'],
  requires: ['html-body'],

  execute(context: CheckContext): CheckOutcome {
    const using = pagesUsingStorage(context.pages);

    if (using.length === 0) {
      return {
        findings: [
          notApplicable(this, {
            reason:
              'No browser storage API was referenced in the inline script analyzed. Storage used from an external script file would not appear here, because external scripts are never downloaded by this assessment.',
            affectedPages: context.pages.map((page) => page.url)
          })
        ]
      };
    }

    const labels = mergedLabels(using, (page) => page.storageIndicators);

    return {
      findings: [
        createFinding(this, {
          status: 'info',
          observation: 'best-practice',
          confidence: 'high',
          source: 'html',
          title: 'Page uses client-accessible browser storage',
          summary:
            'Browser storage is used. Avoid storing credentials, long-lived secrets, session tokens, or other sensitive information in client-accessible storage.',
          explanation:
            'Everything in localStorage, sessionStorage, IndexedDB, and Cache Storage is readable by any script running on this origin — including a third-party script, and including injected script if the page ever has an injection flaw. Unlike an HttpOnly cookie, these stores offer no way to hold a value that script cannot read. Using them is entirely normal for preferences, drafts, and caches; what matters is what goes in. No stored value was read by this assessment, so this is a reminder rather than a finding about this site.',
          recommendation:
            'Keep session identifiers in cookies marked HttpOnly, Secure, and SameSite rather than in browser storage. Keep tokens short-lived and in memory where you can, and clear anything user-specific on sign-out.',
          affectedPages: using.map((page) => page.url),
          aggregationKey: 'in-use',
          occurrences: using.length,
          evidence: [{ label: 'APIs referenced', value: labels.join(', ') }]
        })
      ]
    };
  }
};

/* -------------------------------------------------------------------------- */
/* Service workers                                                            */
/* -------------------------------------------------------------------------- */

export const serviceWorkerCheck: SecurityCheck = {
  id: 'service-worker-indicators',
  category: 'service-workers',
  name: 'Service worker indicators',
  description:
    'Notes service worker registration and caching markers seen in inline script, without touching any worker.',
  severity: 'low',
  scoreWeight: 4,
  modes: ['browser-passive'],
  requires: ['html-body'],

  execute(context: CheckContext): CheckOutcome {
    const using = context.pages.filter((page) => page.serviceWorkerIndicators.length > 0);

    if (using.length === 0) {
      return {
        findings: [
          notApplicable(this, {
            reason:
              'No service worker registration was seen in the inline script analyzed. A worker registered from an external script file would not appear here, and an already-installed worker on the visitor\'s machine is not observable from this page.',
            affectedPages: context.pages.map((page) => page.url)
          })
        ]
      };
    }

    const findings: SecurityFinding[] = [];
    const labels = mergedLabels(using, (page) => page.serviceWorkerIndicators);
    const insecure = using.filter((page) => page.protocol === 'http:');

    if (insecure.length > 0) {
      findings.push(
        createFinding(this, {
          status: 'info',
          observation: 'potential-concern',
          confidence: 'medium',
          source: 'html',
          title: 'Service worker registration on a page served over HTTP',
          summary: `${insecure.length} page${insecure.length === 1 ? '' : 's'} served over plaintext HTTP reference${insecure.length === 1 ? 's' : ''} service worker registration.`,
          explanation:
            'Service workers are restricted to secure contexts, so a browser refuses the registration on an http:// page — localhost excepted. The registration is therefore most likely a no-op rather than a risk. It is worth noting because a worker intercepts every request in its scope, which is exactly the capability that must not be reachable over a connection an attacker can rewrite.',
          recommendation:
            'Serve the page over HTTPS so the worker can register, or remove the registration if it is dead code.',
          affectedPages: insecure.map((page) => page.url),
          aggregationKey: 'insecure-context',
          occurrences: insecure.length
        })
      );
    }

    findings.push(
      createFinding(this, {
        status: 'info',
        observation: 'verified-observation',
        confidence: 'high',
        source: 'html',
        title: 'Page registers a service worker',
        summary: `${using.length} page${using.length === 1 ? '' : 's'} reference${using.length === 1 ? 's' : ''} a service worker or its caches.`,
        explanation:
          'A service worker sits between the page and the network for every request in its scope, and it persists after the tab closes until it is replaced or unregistered. That makes the worker script a high-value asset: a compromise of it, or of anything it caches, outlives a single page load. Its scope and its caching rules were not inspected — doing so would mean reading and running the worker script, which this assessment never does.',
        recommendation:
          'Serve the worker script from your own origin with a narrow scope and a short cache lifetime, keep its path out of any shared cache, and avoid caching authenticated responses in Cache Storage where another script on the origin can read them.',
        affectedPages: using.map((page) => page.url),
        aggregationKey: 'registered',
        occurrences: using.length,
        evidence: [{ label: 'Markers seen', value: labels.join(', ') }]
      })
    );

    return { findings };
  }
};
