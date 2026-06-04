#!/usr/bin/env node
/**
 * Verifies dist-electron outputs after vite build (step 6).
 * vite-plugin-electron bundles main, preload, and workers in one vite build.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const required = [
  'dist-electron/main.js',
  'dist-electron/preload.cjs',
  'dist-electron/syncWorker.js',
  'dist/index.html',
];

for (const rel of required) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) {
    console.error(`Missing ${rel} — run npm run build:renderer first`);
    process.exit(1);
  }
}

console.log('Electron build artifacts OK');
