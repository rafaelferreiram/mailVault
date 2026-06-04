// Local user account system + per-user linked email accounts.
//
// Storage: ~/Library/Application Support/MailVault/users.db (SQLite via better-sqlite3).
// Passwords: bcryptjs, cost factor 12.
// Sessions: in-memory only (see userSession.ts) — user must sign in again after app restart.

import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

const BCRYPT_COST = 12;

export interface UserRow {
  id: string;
  username: string;
  email: string;
  /** Never returned outside this module. */
  password?: string;
  createdAt: number;
  lastLogin: number | null;
}

export interface LinkedAccountRow {
  id: string;
  userId: string;
  provider: 'google' | 'microsoft';
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  /** The key used to retrieve tokens from the OS keychain (typically `${provider}:${email}`). */
  keychainKey: string;
  needsReauth: boolean;
  lastSyncedAt: number | null;
  linkedAt: number;
}

let db: Database.Database | null = null;

export function defaultDbPath(): string {
  // On macOS this resolves to ~/Library/Application Support/MailVault/users.db.
  // On Linux:   ~/.config/MailVault/users.db
  // On Windows: %APPDATA%/MailVault/users.db
  const home = os.homedir();
  const appName = 'MailVault';
  let dir: string;
  if (process.platform === 'darwin') {
    dir = path.join(home, 'Library', 'Application Support', appName);
  } else if (process.platform === 'win32') {
    dir = path.join(process.env.APPDATA || path.join(home, 'AppData', 'Roaming'), appName);
  } else {
    dir = path.join(process.env.XDG_CONFIG_HOME || path.join(home, '.config'), appName);
  }
  return path.join(dir, 'users.db');
}

export function init(dbPath: string = defaultDbPath()): Database.Database {
  if (db) return db;
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id           TEXT PRIMARY KEY,
      username     TEXT UNIQUE NOT NULL,
      email        TEXT UNIQUE NOT NULL,
      password     TEXT NOT NULL,
      created_at   INTEGER NOT NULL,
      last_login   INTEGER
    );

    CREATE TABLE IF NOT EXISTS linked_accounts (
      id              TEXT PRIMARY KEY,
      user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider        TEXT NOT NULL,
      email           TEXT NOT NULL,
      display_name    TEXT,
      avatar_url      TEXT,
      keychain_key    TEXT NOT NULL,
      needs_reauth    INTEGER NOT NULL DEFAULT 0,
      last_synced_at  INTEGER,
      linked_at       INTEGER NOT NULL,
      UNIQUE(user_id, keychain_key)
    );

    CREATE INDEX IF NOT EXISTS idx_linked_user ON linked_accounts(user_id);
  `);
  return db;
}

export function close() {
  if (db) {
    db.close();
    db = null;
  }
}

function require_db(): Database.Database {
  if (!db) return init();
  return db;
}

// ─── Validation ─────────────────────────────────────────────────────────

const USERNAME_RE = /^[a-zA-Z0-9_.-]{3,32}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class ValidationError extends Error {
  field: string;
  constructor(field: string, message: string) {
    super(message);
    this.field = field;
  }
}

function validateRegistration(input: { username: string; email: string; password: string }) {
  if (!USERNAME_RE.test(input.username)) {
    throw new ValidationError(
      'username',
      'Username must be 3–32 characters: letters, numbers, dot, dash, underscore.'
    );
  }
  if (!EMAIL_RE.test(input.email)) {
    throw new ValidationError('email', 'Enter a valid email address.');
  }
  if (input.password.length < 8) {
    throw new ValidationError('password', 'Password must be at least 8 characters.');
  }
  if (input.password.length > 128) {
    throw new ValidationError('password', 'Password is too long (max 128 characters).');
  }
}

// ─── Users ──────────────────────────────────────────────────────────────

export function userCount(): number {
  const row = require_db().prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number };
  return row.n;
}

export async function register(input: {
  username: string;
  email: string;
  password: string;
}): Promise<UserRow> {
  validateRegistration(input);
  const username = input.username.trim();
  const email = input.email.trim().toLowerCase();

  const existing = require_db()
    .prepare('SELECT id FROM users WHERE username = ? OR email = ?')
    .get(username, email);
  if (existing) {
    throw new ValidationError('username', 'A user with that username or email already exists.');
  }

  const id = uuid();
  const hash = await bcrypt.hash(input.password, BCRYPT_COST);
  const now = Date.now();

  require_db()
    .prepare(
      `INSERT INTO users (id, username, email, password, created_at, last_login)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(id, username, email, hash, now, now);

  return {
    id,
    username,
    email,
    createdAt: now,
    lastLogin: now,
  };
}

export async function login(
  identifier: string,
  password: string
): Promise<UserRow | null> {
  const id = identifier.trim().toLowerCase();
  const row = require_db()
    .prepare(
      `SELECT id, username, email, password, created_at AS createdAt, last_login AS lastLogin
       FROM users WHERE lower(username) = ? OR lower(email) = ?`
    )
    .get(id, id) as UserRow | undefined;

  if (!row || !row.password) return null;

  const ok = await bcrypt.compare(password, row.password);
  if (!ok) return null;

  const now = Date.now();
  require_db().prepare('UPDATE users SET last_login = ? WHERE id = ?').run(now, row.id);

  return {
    id: row.id,
    username: row.username,
    email: row.email,
    createdAt: row.createdAt,
    lastLogin: now,
  };
}

export function getUserById(id: string): UserRow | null {
  const row = require_db()
    .prepare(
      `SELECT id, username, email, created_at AS createdAt, last_login AS lastLogin
       FROM users WHERE id = ?`
    )
    .get(id) as UserRow | undefined;
  return row ?? null;
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<void> {
  if (newPassword.length < 8) {
    throw new ValidationError('password', 'New password must be at least 8 characters.');
  }
  const row = require_db()
    .prepare('SELECT password FROM users WHERE id = ?')
    .get(userId) as { password: string } | undefined;
  if (!row) throw new ValidationError('user', 'User not found.');
  const ok = await bcrypt.compare(currentPassword, row.password);
  if (!ok) throw new ValidationError('password', 'Current password is incorrect.');
  const hash = await bcrypt.hash(newPassword, BCRYPT_COST);
  require_db().prepare('UPDATE users SET password = ? WHERE id = ?').run(hash, userId);
}

export function deleteUser(userId: string) {
  require_db().prepare('DELETE FROM users WHERE id = ?').run(userId);
}

// ─── Linked email accounts ──────────────────────────────────────────────

const MAX_LINKED_ACCOUNTS = 4;

function rowToLinked(r: {
  id: string;
  user_id: string;
  provider: 'google' | 'microsoft';
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  keychain_key: string;
  needs_reauth: number;
  last_synced_at: number | null;
  linked_at: number;
}): LinkedAccountRow {
  return {
    id: r.id,
    userId: r.user_id,
    provider: r.provider,
    email: r.email,
    displayName: r.display_name,
    avatarUrl: r.avatar_url,
    keychainKey: r.keychain_key,
    needsReauth: r.needs_reauth === 1,
    lastSyncedAt: r.last_synced_at,
    linkedAt: r.linked_at,
  };
}

export function listLinkedAccounts(userId: string): LinkedAccountRow[] {
  return require_db()
    .prepare(
      `SELECT id, user_id, provider, email, display_name, avatar_url, keychain_key,
              needs_reauth, last_synced_at, linked_at
       FROM linked_accounts WHERE user_id = ? ORDER BY linked_at ASC`
    )
    .all(userId)
    .map((r) => rowToLinked(r as Parameters<typeof rowToLinked>[0]));
}

export function findLinkedByKeychainKey(
  userId: string,
  keychainKey: string
): LinkedAccountRow | null {
  const r = require_db()
    .prepare(
      `SELECT id, user_id, provider, email, display_name, avatar_url, keychain_key,
              needs_reauth, last_synced_at, linked_at
       FROM linked_accounts WHERE user_id = ? AND keychain_key = ?`
    )
    .get(userId, keychainKey);
  return r ? rowToLinked(r as Parameters<typeof rowToLinked>[0]) : null;
}

export function upsertLinkedAccount(input: {
  userId: string;
  provider: 'google' | 'microsoft';
  email: string;
  displayName?: string;
  avatarUrl?: string;
  keychainKey: string;
}): LinkedAccountRow {
  const existing = findLinkedByKeychainKey(input.userId, input.keychainKey);
  const now = Date.now();
  if (existing) {
    require_db()
      .prepare(
        `UPDATE linked_accounts SET email = ?, display_name = ?, avatar_url = ?,
            needs_reauth = 0, last_synced_at = ? WHERE id = ?`
      )
      .run(
        input.email.toLowerCase(),
        input.displayName ?? existing.displayName,
        input.avatarUrl ?? existing.avatarUrl,
        now,
        existing.id
      );
    return findLinkedByKeychainKey(input.userId, input.keychainKey)!;
  }

  const count = (
    require_db()
      .prepare('SELECT COUNT(*) AS n FROM linked_accounts WHERE user_id = ?')
      .get(input.userId) as { n: number }
  ).n;
  if (count >= MAX_LINKED_ACCOUNTS) {
    throw new ValidationError(
      'limit',
      `Maximum of ${MAX_LINKED_ACCOUNTS} linked accounts reached. Remove one first.`
    );
  }

  const id = uuid();
  require_db()
    .prepare(
      `INSERT INTO linked_accounts
        (id, user_id, provider, email, display_name, avatar_url, keychain_key,
         needs_reauth, last_synced_at, linked_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`
    )
    .run(
      id,
      input.userId,
      input.provider,
      input.email.toLowerCase(),
      input.displayName ?? null,
      input.avatarUrl ?? null,
      input.keychainKey,
      now,
      now
    );

  return findLinkedByKeychainKey(input.userId, input.keychainKey)!;
}

export function removeLinkedAccount(userId: string, keychainKey: string) {
  require_db()
    .prepare('DELETE FROM linked_accounts WHERE user_id = ? AND keychain_key = ?')
    .run(userId, keychainKey);
}

export function setLinkedAccountFlag(
  userId: string,
  keychainKey: string,
  patch: { needsReauth?: boolean; lastSyncedAt?: number }
) {
  const sets: string[] = [];
  const vals: Array<number | string> = [];
  if (patch.needsReauth !== undefined) {
    sets.push('needs_reauth = ?');
    vals.push(patch.needsReauth ? 1 : 0);
  }
  if (patch.lastSyncedAt !== undefined) {
    sets.push('last_synced_at = ?');
    vals.push(patch.lastSyncedAt);
  }
  if (!sets.length) return;
  vals.push(userId, keychainKey);
  require_db()
    .prepare(`UPDATE linked_accounts SET ${sets.join(', ')} WHERE user_id = ? AND keychain_key = ?`)
    .run(...vals);
}

export const MAX_LINKED = MAX_LINKED_ACCOUNTS;
