// In-memory MailVault user session.
// Lives only in the main process. A session is forgotten on app exit, by design —
// the user must sign in again every time they launch the app.

import type { UserRow } from './userDb.js';

let current: UserRow | null = null;

const listeners = new Set<(u: UserRow | null) => void>();

export function getCurrentUser(): UserRow | null {
  return current;
}

export function setCurrentUser(user: UserRow | null) {
  current = user;
  for (const fn of listeners) fn(user);
}

export function requireUser(): UserRow {
  if (!current) {
    const err = new Error('Not signed in.');
    (err as Error & { code: string }).code = 'NO_SESSION';
    throw err;
  }
  return current;
}

export function onSessionChanged(fn: (u: UserRow | null) => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
