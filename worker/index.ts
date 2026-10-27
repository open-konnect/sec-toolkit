import { RELAY_PATH, handleRelay } from './proxy';

interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === RELAY_PATH) return handleRelay(request);
    return env.ASSETS.fetch(request);
  }
};
