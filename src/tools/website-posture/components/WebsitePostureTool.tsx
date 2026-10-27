import React, { useCallback, useRef, useState } from 'react';
import { Globe, Play, ScanSearch, Square } from 'lucide-react';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorMessage } from '../../../components/ui/ErrorMessage';
import { ShieldCheck } from 'lucide-react';
import { analytics } from '../../../lib/analytics';
import { CHECK_REGISTRY } from '../logic/checkRegistry';
import { DISCOVERY_LIMITS } from '../logic/discovery';
import { createLiveFetcher } from '../logic/fetchers/liveFetcher';
import { createRelayFetcher } from '../logic/fetchers/relayFetcher';
import { createStaticFetcher } from '../logic/fetchers/staticFetcher';
import { parseHeaderBlock } from '../logic/headerInput';
import { createBrowserPassiveRunner } from '../logic/runners/browserPassiveRunner';
import { parseTarget } from '../logic/target';
import { AssessmentProgress, SecurityAssessment } from '../types';
import { AssessmentProgress as ProgressPanel } from './AssessmentProgress';
import { AssessmentReport } from './AssessmentReport';
import { pluralize } from './presentation';

type SourceMode = 'relay' | 'direct' | 'paste';

const MAX_PASTED_HTML = 2 * 1024 * 1024;

export const WebsitePostureTool: React.FC = () => {
  const [url, setUrl] = useState('');
  const [sourceMode, setSourceMode] = useState<SourceMode>('relay');
  const [pastedHtml, setPastedHtml] = useState('');
  const [pastedHeaders, setPastedHeaders] = useState('');
  const [maxPages, setMaxPages] = useState(1);
  const [maxDepth, setMaxDepth] = useState(0);

  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<AssessmentProgress | null>(null);
  const [error, setError] = useState('');
  const [assessment, setAssessment] = useState<SecurityAssessment | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const handleRun = useCallback(async () => {
    const parsed = parseTarget(url);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }

    if (sourceMode === 'paste' && pastedHtml.trim().length === 0) {
      setError('Paste the page source you want assessed, or switch to Scan URL.');
      return;
    }
    if (pastedHtml.length > MAX_PASTED_HTML) {
      setError('That page source is larger than 2 MB. Trim it and try again.');
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;

    setError('');
    setAssessment(null);
    setRunning(true);

    // Only non-identifying shape data is tracked: never the target URL, the
    // page source, or anything derived from the response.
    analytics.track('tool_used', {
      tool: 'website-security-posture',
      action: 'run_assessment',
      sourceMode,
      maxPages: sourceMode === 'paste' ? 1 : maxPages
    });

    try {
      const fetcher =
        sourceMode === 'relay'
          ? createRelayFetcher()
          : sourceMode === 'direct'
            ? createLiveFetcher({
                selfOrigin: typeof window === 'undefined' ? undefined : window.location.origin
              })
            : createStaticFetcher([
              {
                url: parsed.target.url,
                html: pastedHtml,
                ...(pastedHeaders.trim()
                  ? { headers: parseHeaderBlock(pastedHeaders), headersAreComplete: true }
                  : {})
              }
            ]);

      const runner = createBrowserPassiveRunner({ fetcher });

      const result = await runner.run({
        target: parsed.target,
        discovery: sourceMode === 'paste' ? undefined : { maxPages, maxDepth },
        signal: controller.signal,
        onProgress: setProgress
      });

      setAssessment(result);
    } catch (runError) {
      // The runner isolates stage failures internally, so reaching here means
      // something unexpected happened. The message stays generic.
      setError(
        runError instanceof Error
          ? `The assessment could not be completed (${runError.name}).`
          : 'The assessment could not be completed.'
      );
    } finally {
      setRunning(false);
      setProgress(null);
      abortRef.current = null;
    }
  }, [url, sourceMode, pastedHtml, pastedHeaders, maxPages, maxDepth]);

  return (
    <div className="space-y-6">
      <div className="p-4 rounded-xl bg-slate-900/60 border border-emerald-900/30 flex items-start gap-3">
        <div className="p-2 rounded-lg bg-emerald-950/60 border border-emerald-800/50 text-emerald-400 shrink-0">
          <ShieldCheck className="w-5 h-5" aria-hidden="true" />
        </div>
        <div className="space-y-1">
          <h4 className="text-sm font-semibold text-emerald-300">What leaves your browser</h4>
          <p className="text-xs text-slate-300 leading-relaxed">
            <strong className="text-white">Scan URL</strong> sends the target address to this site&apos;s
            stateless fetch relay, because browsers cannot read other sites&apos; pages or headers. The relay
            makes read-only GET requests, keeps nothing, and the analysis and report stay in this tab.{' '}
            <strong className="text-white">Direct from browser</strong> and{' '}
            <strong className="text-white">Paste page source</strong> send nothing to this site. Cookies and
            credentials are never sent, and results are never uploaded.
          </p>
        </div>
      </div>

      {/* Target configuration */}
      <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-emerald-400" />
            <h3 className="text-sm font-bold text-white tracking-tight">Assessment target</h3>
          </div>

          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs font-mono">
            {(
              [
                { id: 'relay', label: 'Scan URL' },
                { id: 'direct', label: 'Direct from browser' },
                { id: 'paste', label: 'Paste page source' }
              ] as const
            ).map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setSourceMode(option.id)}
                className={`px-2.5 py-1 rounded transition-colors ${
                  sourceMode === option.id
                    ? 'bg-slate-800 text-emerald-400 font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="posture-url" className="text-xs font-mono text-slate-400">
            Website URL
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              id="posture-url"
              type="url"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://example.com"
              className="flex-1 px-3 py-2 rounded-lg border border-slate-800 bg-slate-950 font-mono text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500"
            />
            {running ? (
              <Button variant="danger" icon={<Square className="w-4 h-4" />} onClick={handleCancel}>
                Cancel
              </Button>
            ) : (
              <Button variant="primary" icon={<Play className="w-4 h-4" />} onClick={handleRun}>
                Run assessment
              </Button>
            )}
          </div>
        </div>

        {sourceMode !== 'paste' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label htmlFor="posture-max-pages" className="text-xs font-mono text-slate-400">
                Max pages ({maxPages})
              </label>
              <input
                id="posture-max-pages"
                type="range"
                min={1}
                max={DISCOVERY_LIMITS.maxPages}
                value={maxPages}
                onChange={(event) => setMaxPages(Number(event.target.value))}
                className="w-full accent-emerald-500"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="posture-max-depth" className="text-xs font-mono text-slate-400">
                Max link depth ({maxDepth})
              </label>
              <input
                id="posture-max-depth"
                type="range"
                min={0}
                max={DISCOVERY_LIMITS.maxDepth}
                value={maxDepth}
                onChange={(event) => setMaxDepth(Number(event.target.value))}
                className="w-full accent-emerald-500"
              />
            </div>
            <p className="sm:col-span-2 text-xs text-slate-400 leading-relaxed">
              Only same-origin pages the target already links to are read, with GET requests, no
              cookies, and no form submissions.{' '}
              {sourceMode === 'relay'
                ? 'The URL is sent to this site\'s fetch relay, which makes one read-only request for each page and returns the text and security headers. The relay does not store or log what it reads; all analysis happens in this tab.'
                : 'Nothing but the target itself is contacted. Most sites block cross-origin reads, in which case checks are reported as unverified rather than as problems — use Scan URL for those.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <label htmlFor="posture-html" className="text-xs font-mono text-slate-400">
              Page source (View Source → paste)
            </label>
            <textarea
              id="posture-html"
              value={pastedHtml}
              onChange={(event) => setPastedHtml(event.target.value)}
              spellCheck={false}
              rows={8}
              placeholder="<!DOCTYPE html> ..."
              className="w-full px-3 py-2 rounded-lg border border-slate-800 bg-slate-950 font-mono text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 resize-y"
            />
            <p className="text-xs text-slate-400 leading-relaxed">
              Nothing is requested over the network in this mode. The markup is parsed inertly in
              this tab — scripts it contains are never executed, and no linked resource is fetched.
            </p>

            <label htmlFor="posture-headers" className="text-xs font-mono text-slate-400 block pt-2">
              Response headers (optional — paste the complete set, e.g. from <code>curl -I</code> or
              DevTools → Network)
            </label>
            <textarea
              id="posture-headers"
              value={pastedHeaders}
              onChange={(event) => setPastedHeaders(event.target.value)}
              spellCheck={false}
              rows={5}
              placeholder={'HTTP/2 200\ncontent-security-policy: default-src \'self\'\nstrict-transport-security: max-age=31536000'}
              className="w-full px-3 py-2 rounded-lg border border-slate-800 bg-slate-950 font-mono text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 resize-y"
            />
            <p className="text-xs text-slate-400 leading-relaxed">
              Browsers cannot read another site's security headers, so header checks (CSP, HSTS,
              framing, cookies, and so on) stay unverified unless you supply them. Only a fixed
              list of security-relevant headers is kept; cookies and authorization headers are
              discarded. If you leave this empty, a missing header is never reported as a problem.
              Only paste the full header set — a partial list would make absent headers look
              missing.
            </p>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 border-t border-slate-800 pt-3">
          <Badge variant="outline" size="sm">
            {CHECK_REGISTRY.length} passive {pluralize(CHECK_REGISTRY.length, 'check')}
          </Badge>
          <Badge variant="outline" size="sm">
            Read-only GET
          </Badge>
          <Badge variant="outline" size="sm">
            No credentials sent
          </Badge>
        </div>
      </div>

      {error && <ErrorMessage message={error} />}

      {running && <ProgressPanel progress={progress} onCancel={handleCancel} />}

      {/* Report */}
      {assessment && <AssessmentReport assessment={assessment} />}

      {!assessment && !running && !error && (
        <EmptyState
          icon={<ScanSearch className="w-8 h-8" />}
          title="No assessment run yet"
          description="Enter a URL to run a passive, read-only posture assessment with analysis and reporting inside this browser tab. Results are never uploaded, logged, or stored."
        />
      )}
    </div>
  );
};
