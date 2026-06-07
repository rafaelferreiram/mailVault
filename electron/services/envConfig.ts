// OAuth credential loading for dev and packaged builds.
//
// Dev: reads project-root `.env`.
// Packaged: seeds ~/Library/Application Support/MailVault/.env from bundled
// resources (populated at deploy time) so token refresh always has client_id.

import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function parseEnvFile(envPath: string, overwrite: boolean): boolean {
  if (!fs.existsSync(envPath)) return false;
  try {
    const text = fs.readFileSync(envPath, 'utf8');
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq < 0) continue;
      const key = line.slice(0, eq).trim();
      let val = line.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (overwrite || process.env[key] === undefined) {
        process.env[key] = val;
      }
    }
    return true;
  } catch (err) {
    console.warn(`[env] failed to read ${envPath}:`, (err as Error).message);
    return false;
  }
}

function normalizeOAuthEnv() {
  process.env.VITE_GOOGLE_CLIENT_ID ??= process.env.GOOGLE_CLIENT_ID ?? '';
  process.env.VITE_GOOGLE_CLIENT_SECRET ??= process.env.GOOGLE_CLIENT_SECRET ?? '';
  process.env.VITE_MICROSOFT_CLIENT_ID ??= process.env.MICROSOFT_CLIENT_ID ?? '';
}

/** Writable .env path — survives app updates in /Applications. */
export function resolveUserEnvPath(): string {
  try {
    return path.join(app.getPath('userData'), '.env');
  } catch {
    return path.resolve(process.cwd(), '.env');
  }
}

function bundledEnvPaths(): string[] {
  const paths: string[] = [];
  if (process.resourcesPath) {
    paths.push(path.join(process.resourcesPath, '.env'));
  }
  try {
    paths.push(path.join(app.getAppPath(), '.env'));
  } catch {
    // app not ready yet
  }
  paths.push(path.resolve(__dirname, '..', '.env'));
  paths.push(path.resolve(__dirname, '..', '..', '.env'));
  return paths;
}

function bundledExamplePaths(): string[] {
  const paths: string[] = [];
  if (process.resourcesPath) {
    paths.push(path.join(process.resourcesPath, '.env.example'));
  }
  try {
    paths.push(path.join(app.getAppPath(), '.env.example'));
  } catch {
    // app not ready yet
  }
  paths.push(path.resolve(__dirname, '..', '.env.example'));
  paths.push(path.resolve(__dirname, '..', '..', '.env.example'));
  return paths;
}

/** Create userData/.env from bundled or example template if missing. */
export function seedUserEnvIfMissing(): string {
  const target = resolveUserEnvPath();
  if (fs.existsSync(target)) return target;

  fs.mkdirSync(path.dirname(target), { recursive: true });

  for (const src of bundledEnvPaths()) {
    if (src !== target && fs.existsSync(src)) {
      fs.copyFileSync(src, target);
      console.log(`[env] seeded ${target} from ${src}`);
      return target;
    }
  }

  for (const src of bundledExamplePaths()) {
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, target);
      console.log(`[env] seeded ${target} from ${src}`);
      return target;
    }
  }

  return target;
}

/**
 * Load OAuth env vars from bundled/dev paths, then userData (highest priority).
 * Safe to call repeatedly — re-reads userData/.env each time.
 */
export function loadOAuthEnv(options?: { overwriteBundled?: boolean }): void {
  const overwriteBundled = options?.overwriteBundled ?? false;

  for (const p of bundledEnvPaths()) {
    parseEnvFile(p, overwriteBundled);
  }

  try {
    seedUserEnvIfMissing();
    parseEnvFile(resolveUserEnvPath(), true);
  } catch (err) {
    console.warn('[env] user .env load failed:', (err as Error).message);
  }

  normalizeOAuthEnv();
}

/** Early boot load before `app` is ready (dev project-root only). */
export function loadOAuthEnvEarly(): void {
  parseEnvFile(path.resolve(__dirname, '..', '.env'), false);
  parseEnvFile(path.resolve(__dirname, '..', '..', '.env'), false);
  normalizeOAuthEnv();
}

export function oauthEnvStatus() {
  loadOAuthEnv({ overwriteBundled: true });
  const envPath = resolveUserEnvPath();
  const googleId = (process.env.VITE_GOOGLE_CLIENT_ID ?? '').trim();
  const googleSecret = (process.env.VITE_GOOGLE_CLIENT_SECRET ?? '').trim();
  const msId = (process.env.VITE_MICROSOFT_CLIENT_ID ?? '').trim();
  return {
    google: {
      configured: !!googleId && !!googleSecret,
      clientId: !!googleId,
      clientSecret: !!googleSecret,
    },
    microsoft: {
      configured: !!msId,
      clientId: !!msId,
    },
    envPath,
    envExists: fs.existsSync(envPath),
  };
}

export type OAuthProvider = 'google' | 'microsoft';

export function assertOAuthConfigured(provider: OAuthProvider): void {
  loadOAuthEnv();
  if (provider === 'google') {
    const id = (process.env.VITE_GOOGLE_CLIENT_ID ?? '').trim();
    const secret = (process.env.VITE_GOOGLE_CLIENT_SECRET ?? '').trim();
    if (!id || !secret) {
      throw new Error(
        'Missing Google OAuth credentials. Set VITE_GOOGLE_CLIENT_ID and VITE_GOOGLE_CLIENT_SECRET in ' +
          resolveUserEnvPath()
      );
    }
    return;
  }
  const msId = (process.env.VITE_MICROSOFT_CLIENT_ID ?? '').trim();
  if (!msId) {
    throw new Error(
      'Missing Microsoft OAuth client ID. Set VITE_MICROSOFT_CLIENT_ID in ' + resolveUserEnvPath()
    );
  }
}

export function assertOAuthForAccount(accountId: string): void {
  const provider: OAuthProvider = accountId.startsWith('google:') ? 'google' : 'microsoft';
  assertOAuthConfigured(provider);
}
