import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { cloudflare } from "@cloudflare/vite-plugin";

const projectRoot = dirname(fileURLToPath(import.meta.url));

// https://vitejs.dev/config/
export default defineConfig(({ isSsrBuild, mode }) => {
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
    plugins: isTest ? [react()] : [react(), cloudflare()],
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
