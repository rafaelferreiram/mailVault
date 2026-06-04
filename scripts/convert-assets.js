#!/usr/bin/env node
/**
 * SVG → PNG brand asset conversion for MailVault deploy.
 *
 * Uses `sharp` when installed; otherwise falls back to `npx sharp-cli`.
 * Source SVGs live in assets/brand/ (see resources/medias/ for originals).
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ASSETS = path.join(__dirname, '../assets/brand');

const conversions = [
  { input: 'app-icon-1024.svg', output: 'app-icon-1024.png', size: 1024 },
  { input: 'favicon-32.svg', output: 'favicon-32.png', size: 32 },
  { input: 'menubar-template.svg', output: 'menubar-template.png', size: 44 },
];

async function withSharp() {
  const sharp = (await import('sharp')).default;
  for (const { input, output, size } of conversions) {
    const src = path.join(ASSETS, input);
    const dest = path.join(ASSETS, output);
    if (!fs.existsSync(src)) {
      console.warn(`Not found: ${input}`);
      continue;
    }
    await sharp(src).resize(size, size).png().toFile(dest);
    console.log(`Done: ${output} (${size}x${size})`);
  }
}

function withSharpCli() {
  for (const { input, output, size } of conversions) {
    const src = path.join(ASSETS, input);
    const dest = path.join(ASSETS, output);
    if (!fs.existsSync(src)) {
      console.warn(`Not found: ${input}`);
      continue;
    }
    const r = spawnSync(
      'npx',
      ['--yes', 'sharp-cli', '--input', src, '--output', dest, 'resize', String(size), String(size)],
      { stdio: 'inherit' }
    );
    if (r.status !== 0) {
      throw new Error(`sharp-cli failed for ${input}`);
    }
    console.log(`Done: ${output} (${size}x${size})`);
  }
}

async function run() {
  try {
    await import('sharp');
    await withSharp();
  } catch {
    console.warn('sharp not installed — using npx sharp-cli');
    withSharpCli();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
