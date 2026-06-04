// Worker-thread → main-process bridge.
//
// Workers cannot touch keytar / safeStorage / electron-store directly, so any
// privileged work (token refresh, account profile updates) round-trips through
// the parent port. Each request gets a `reqId` and the parent replies with the
// same id; we resolve the matching promise.

import { parentPort } from 'node:worker_threads';

export interface WorkerInbound {
  type: 'TOKEN_REFRESH_RESPONSE';
  reqId: string;
  ok: boolean;
  accessToken?: string;
  error?: { code: string; message: string };
}

export interface CancelInbound {
  type: 'CANCEL_SYNC';
}

export type AnyInbound = WorkerInbound | CancelInbound;

const pending = new Map<
  string,
  { resolve: (token: string) => void; reject: (e: Error) => void }
>();

let cancelHandler: (() => void) | null = null;

export function onCancel(fn: () => void) {
  cancelHandler = fn;
}

if (parentPort) {
  parentPort.on('message', (msg: AnyInbound) => {
    if (!msg || typeof msg !== 'object') return;

    if (msg.type === 'TOKEN_REFRESH_RESPONSE') {
      const slot = pending.get(msg.reqId);
      if (!slot) return;
      pending.delete(msg.reqId);
      if (msg.ok && msg.accessToken) {
        slot.resolve(msg.accessToken);
      } else {
        const err = new TokenRefreshError(
          msg.error?.code ?? 'unknown',
          msg.error?.message ?? 'Token refresh failed'
        );
        slot.reject(err);
      }
      return;
    }

    if (msg.type === 'CANCEL_SYNC') {
      cancelHandler?.();
      return;
    }
  });
}

export class TokenRefreshError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

let reqCounter = 0;
function nextReqId(): string {
  reqCounter += 1;
  return `r${Date.now().toString(36)}-${reqCounter}`;
}

/**
 * Asks the main process to refresh tokens for `accountId` and returns the new
 * access token. Throws `TokenRefreshError` if main reports failure.
 */
export function requestTokenRefresh(accountId: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!parentPort) {
      reject(new Error('Worker has no parentPort — cannot refresh token.'));
      return;
    }
    const reqId = nextReqId();
    pending.set(reqId, { resolve, reject });
    parentPort.postMessage({
      type: 'TOKEN_REFRESH_REQUEST',
      reqId,
      accountId,
    });
  });
}

export function postMain(message: unknown) {
  parentPort?.postMessage(message);
}
