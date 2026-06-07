#!/usr/bin/env node
/** Seed gitignored accountRoutingRules.local.ts from the example template when missing. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const configDir = path.join(dir, '..', 'electron', 'config');
const local = path.join(configDir, 'accountRoutingRules.local.ts');
const example = path.join(configDir, 'accountRoutingRules.local.example.ts');

if (!fs.existsSync(local) && fs.existsSync(example)) {
  fs.copyFileSync(example, local);
}
