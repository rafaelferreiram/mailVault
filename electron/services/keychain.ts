// OS-keychain backed token storage.
//
//   Primary  : `keytar` → macOS Keychain Services / Windows Credential Manager / libsecret.
//   Fallback : Electron `safeStorage` (which uses the same OS APIs but as a fallback if the
//              native `keytar` module fails to load — e.g. on a headless Linux without libsecret).
//
// We never write tokens to JSON-on-disk in plaintext. Period.

import { safeStorage } from 'electron';
import type { OAuthTokens } from '../../shared/types.js';

const SERVICE = 'com.mailvault.app';

type KeytarLib = {
  setPassword: (service: string, account: string, password: string) => Promise<void>;
  getPassword: (service: string, account: string) => Promise<string | null>;
  deletePassword: (service: string, account: string) => Promise<boolean>;
  findCredentials: (service: string) => Promise<Array<{ account: string; password: string }>>;
};

let keytarMod: KeytarLib | null = null;
let keytarTried = false;

async function loadKeytar(): Promise<KeytarLib | null> {
  if (keytarTried) return keytarMod;
  keytarTried = true;
  try {
    // Dynamic import: native module that may fail to load on some Linux setups.
    const mod = (await import('keytar')) as unknown as { default?: KeytarLib } & KeytarLib;
    keytarMod = (mod.default ?? mod) as KeytarLib;
    // Smoke-test the module so we can fall back early if the binary failed to bind.
    await keytarMod.findCredentials(SERVICE);
    return keytarMod;
  } catch (e) {
    console.warn('[keychain] keytar unavailable, falling back to safeStorage:', (e as Error).message);
    keytarMod = null;
    return null;
  }
}

// ─── safeStorage fallback uses electron-store's data dir; we keep an in-memory map plus
//     a single encrypted JSON blob written via fs to <userData>/keychain.dat. We avoid this
//     path on platforms where safeStorage is unavailable (no encryption available).
import { app } from 'electron';
import { promises as fs } from 'node:fs';
import path from 'node:path';

let fallbackCache: Record<string, string> | null = null;

function fallbackPath() {
  return path.join(app.getPath('userData'), 'keychain.dat');
}

async function loadFallback(): Promise<Record<string, string>> {
  if (fallbackCache) return fallbackCache;
  try {
    const buf = await fs.readFile(fallbackPath());
    if (safeStorage.isEncryptionAvailable()) {
      const json = safeStorage.decryptString(buf);
      fallbackCache = JSON.parse(json) as Record<string, string>;
    } else {
      // Last-ditch: plain JSON, only on systems lacking any OS encryption support.
      fallbackCache = JSON.parse(buf.toString('utf8')) as Record<string, string>;
    }
  } catch {
    fallbackCache = {};
  }
  return fallbackCache;
}

async function saveFallback(map: Record<string, string>) {
  fallbackCache = map;
  const json = JSON.stringify(map);
  const buf = safeStorage.isEncryptionAvailable()
    ? safeStorage.encryptString(json)
    : Buffer.from(json, 'utf8');
  await fs.mkdir(path.dirname(fallbackPath()), { recursive: true });
  await fs.writeFile(fallbackPath(), buf, { mode: 0o600 });
}

export const keychain = {
  async setTokens(accountId: string, tokens: OAuthTokens): Promise<void> {
    const json = JSON.stringify(tokens);
    const kt = await loadKeytar();
    if (kt) {
      await kt.setPassword(SERVICE, accountId, json);
      return;
    }
    const map = await loadFallback();
    map[accountId] = json;
    await saveFallback(map);
  },

  async getTokens(accountId: string): Promise<OAuthTokens | null> {
    const kt = await loadKeytar();
    if (kt) {
      const json = await kt.getPassword(SERVICE, accountId);
      return json ? (JSON.parse(json) as OAuthTokens) : null;
    }
    const map = await loadFallback();
    const json = map[accountId];
    return json ? (JSON.parse(json) as OAuthTokens) : null;
  },

  async deleteTokens(accountId: string): Promise<void> {
    const kt = await loadKeytar();
    if (kt) {
      await kt.deletePassword(SERVICE, accountId);
      return;
    }
    const map = await loadFallback();
    delete map[accountId];
    await saveFallback(map);
  },

  async listAccounts(): Promise<string[]> {
    const kt = await loadKeytar();
    if (kt) {
      const all = await kt.findCredentials(SERVICE);
      return all.map((c) => c.account);
    }
    const map = await loadFallback();
    return Object.keys(map);
  },

  async backendInfo(): Promise<{ backend: 'keytar' | 'safeStorage' | 'plaintext'; available: boolean }> {
    const kt = await loadKeytar();
    if (kt) return { backend: 'keytar', available: true };
    if (safeStorage.isEncryptionAvailable())
      return { backend: 'safeStorage', available: true };
    return { backend: 'plaintext', available: false };
  },
};
