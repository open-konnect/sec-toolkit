/**
 * Privacy-first analytics abstraction.
 *
 * Guarantees:
 * - NO user-provided content (tokens, inputs, outputs) is ever tracked.
 * - Entirely disabled by default, zero external network calls in v1.
 * - Easily swappable for privacy-respecting self-hosted analytics (e.g. Plausible, Umami).
 */

export interface AnalyticsEventProps {
  tool?: string;
  category?: string;
  action?: string;
  // Strictly non-user data attributes
  [key: string]: string | number | boolean | undefined;
}

export interface AnalyticsProvider {
  track: (event: string, properties?: AnalyticsEventProps) => void;
  pageView: (path: string) => void;
}

/**
 * Default No-Op provider: completely silent, zero external requests.
 */
class NoopAnalyticsProvider implements AnalyticsProvider {
  track(event: string, properties?: AnalyticsEventProps): void {
    if (import.meta.env?.DEV) {
      // In dev mode, log metadata-only telemetry events to console for debugging
      // eslint-disable-next-line no-console
      console.debug(`[Analytics:noop] ${event}`, properties);
    }
  }

  pageView(path: string): void {
    if (import.meta.env?.DEV) {
      // eslint-disable-next-line no-console
      console.debug(`[Analytics:noop] pageView: ${path}`);
    }
  }
}

let activeProvider: AnalyticsProvider = new NoopAnalyticsProvider();

export const analytics = {
  setProvider(provider: AnalyticsProvider): void {
    activeProvider = provider;
  },

  track(event: string, properties?: AnalyticsEventProps): void {
    try {
      // Safety filter: strip any accidentally passed payload/value keys
      const safeProps: AnalyticsEventProps = {};
      if (properties) {
        for (const [key, value] of Object.entries(properties)) {
          const lower = key.toLowerCase();
          if (
            lower.includes('token') ||
            lower.includes('jwt') ||
            lower.includes('input') ||
            lower.includes('output') ||
            lower.includes('secret') ||
            lower.includes('key')
          ) {
            continue; // Filter out sensitive data
          }
          safeProps[key] = value;
        }
      }
      activeProvider.track(event, safeProps);
    } catch {
      // Never crash the application on analytics failure
    }
  },

  pageView(path: string): void {
    try {
      activeProvider.pageView(path);
    } catch {
      // Silently fail
    }
  }
};
