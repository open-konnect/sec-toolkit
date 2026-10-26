import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ isSsrBuild }) => ({
  plugins: [react()],
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
