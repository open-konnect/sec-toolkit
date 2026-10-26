import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = dirname(fileURLToPath(import.meta.url));

/**
 * Dedicated build config for the SEO prerender bundle.
 *
 * This is intentionally separate from `vite.config.ts` so the SSR build has one
 * unambiguous entry, output directory, and entry filename. The generator in
 * `scripts/generate-seo.mjs` imports the emitted `dist-ssr/prerender.js`.
 *
 * This is a build-time bundle only. It is never deployed or served at runtime;
 * Cloudflare Pages still receives a fully static site from `dist`.
 */
export default defineConfig({
  // Anchor the build to this config file, not the caller's working directory.
  // This guarantees that `dist-ssr` is written next to `scripts/generate-seo.mjs`'s
  // resolved project root.
  root: projectRoot,
  plugins: [react()],
  // `dist-ssr` is a build-time module graph, not a deployable site. The client
  // build already copies public assets into `dist`, so skip that copy here.
  publicDir: false,
  ssr: {
    target: 'node'
  },
  build: {
    ssr: 'src/seo/prerender.tsx',
    outDir: 'dist-ssr',
    emptyOutDir: true,
    // Cloudflare Pages' build image runs a Node.js version that supports the
    // node18 target. Pinning the target here avoids emitting runtime syntax
    // that is newer than the build environment.
    target: 'node18',
    sourcemap: false,
    minify: false,
    rollupOptions: {
      output: {
        format: 'es',
        // Without this, the entry filename is derived by Rollup and can change
        // if the package/module type changes. The SEO generator relies on it.
        entryFileNames: 'prerender.js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]'
      }
    }
  }
});
