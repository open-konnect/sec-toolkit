import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { cloudflare } from "@cloudflare/vite-plugin";

const projectRoot = dirname(fileURLToPath(import.meta.url));

// https://vitejs.dev/config/
export default defineConfig(({ command, isSsrBuild, mode }) => {
  // Vitest uses this config to start a dev server. The Cloudflare plugin starts
  // its own Vite server while resolving the config, which makes Vitest fail
  // with "There is already a server associated with the config". Unit tests
  // only exercise pure logic, so the Workers runtime integration is not needed.
  const isTest = mode === 'test' || process.env.VITEST === 'true';

  return {
    // Anchor both the client and SSR builds to this repository. Cloudflare runs
    // the build command on its own, so relying on Vite's default `root` (the
    // caller's cwd) can put `dist`/`dist-ssr` somewhere the SEO generator does
    // not look.
    root: projectRoot,
    plugins: isTest
      ? [react()]
      : [
          react(),
          cloudflare({
            // The dev server has no prerendered pages, so the production
            // `404-page` setting would 404 every deep link such as
            // /website-security-posture. Fall back to the SPA shell in dev
            // only; production keeps real prerendered pages and a real 404.
            config:
              command === 'serve'
                ? { assets: { not_found_handling: 'single-page-application' } }
                : undefined
          })
        ],
    build: {
      target: 'es2022',
      sourcemap: false,
      rollupOptions: {
        output: {
          // The SSR bundle externalizes React and must not use client chunks.
          ...(isSsrBuild
            ? {}
            : {
                manualChunks: {
                  vendor: ['react', 'react-dom', 'react-router-dom', 'lucide-react']
                }
              })
        }
      }
    }
  };
});
