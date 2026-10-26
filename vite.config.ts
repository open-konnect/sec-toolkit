import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { cloudflare } from "@cloudflare/vite-plugin";

const projectRoot = dirname(fileURLToPath(import.meta.url));

// https://vitejs.dev/config/
export default defineConfig(({ isSsrBuild }) => ({
  // Anchor both the client and SSR builds to this repository. Cloudflare runs
  // the build command on its own, so relying on Vite's default `root` (the
  // caller's cwd) can put `dist`/`dist-ssr` somewhere the SEO generator does
  // not look.
  root: projectRoot,
  plugins: [react(), cloudflare()],
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
}));