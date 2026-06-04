import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron/simple';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@shared': path.resolve(__dirname, 'shared'),
    },
  },
  plugins: [
    react(),
    electron({
      main: {
        // The plugin treats `entry` as the primary input. We extend
        // rollupOptions.input below so the sync worker is bundled alongside
        // main.js in the same `dist-electron/` directory; this is required
        // because the main process spawns it via `new Worker(path.join(__dirname,
        // 'syncWorker.js'))` at runtime.
        entry: 'electron/main.ts',
        vite: {
          build: {
            outDir: 'dist-electron',
            rollupOptions: {
              input: {
                main: path.join(__dirname, 'electron/main.ts'),
                syncWorker: path.join(__dirname, 'electron/workers/syncWorker.ts'),
                intelligenceWorker: path.join(
                  __dirname,
                  'electron/workers/intelligenceWorker.ts'
                ),
              },
              external: [
                'electron',
                'keytar',
                'electron-store',
                'better-sqlite3',
                'bcryptjs',
                'chalk',
              ],
              output: {
                entryFileNames: '[name].js',
                format: 'es',
              },
            },
          },
        },
      },
      preload: {
        input: path.join(__dirname, 'electron/preload.ts'),
        vite: {
          build: {
            outDir: 'dist-electron',
            rollupOptions: {
              external: ['electron'],
              output: {
                // Electron's sandboxed preload must be CommonJS. Our package.json
                // has "type": "module", so we use .cjs to opt out of ESM parsing.
                format: 'cjs',
                entryFileNames: '[name].cjs',
              },
            },
          },
        },
      },
      renderer: {},
    }),
  ],
  build: {
    outDir: 'dist',
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
