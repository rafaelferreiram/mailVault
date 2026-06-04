#!/usr/bin/env node
/**
 * Patches node_modules/electron/dist/Electron.app on macOS so the Dock and
 * Finder show "MailVault" instead of "Electron" during `npm run dev`.
 *
 * Re-run automatically via postinstall and the dev script (npm reinstall
 * restores the stock Electron branding).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const APP_NAME = 'MailVault';
const PLIST_BUDDY = '/usr/libexec/PlistBuddy';

function setPlistKey(plistPath, key, value) {
  const args = ['-c', `Set :${key} ${value}`, plistPath];
  try {
    execFileSync(PLIST_BUDDY, args, { stdio: 'pipe' });
  } catch {
    execFileSync(PLIST_BUDDY, ['-c', `Add :${key} string ${value}`, plistPath], {
      stdio: 'pipe',
    });
  }
}

if (process.platform !== 'darwin') {
  process.exit(0);
}

if (!fs.existsSync(PLIST_BUDDY)) {
  console.warn('[mailvault] PlistBuddy not found — skip Electron branding patch');
  process.exit(0);
}

const electronApp = path.join(ROOT, 'node_modules/electron/dist/Electron.app');
const plistPath = path.join(electronApp, 'Contents/Info.plist');

if (!fs.existsSync(plistPath)) {
  console.warn('[mailvault] Electron.app not found — skip dock branding patch');
  process.exit(0);
}

setPlistKey(plistPath, 'CFBundleDisplayName', APP_NAME);
setPlistKey(plistPath, 'CFBundleName', APP_NAME);
setPlistKey(plistPath, 'LSApplicationCategoryType', 'public.app-category.productivity');

const iconSrc = path.join(ROOT, 'assets/icon.icns');
const iconDest = path.join(electronApp, 'Contents/Resources/electron.icns');
if (fs.existsSync(iconSrc)) {
  fs.copyFileSync(iconSrc, iconDest);
}

console.log(`[mailvault] Dev Electron.app branded as "${APP_NAME}" (Dock + icon)`);
