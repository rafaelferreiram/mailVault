/**
 * Cancellable sleep — resolves on either timeout or signal abort.
 *
 * Important: we must explicitly remove the abort listener when the timer wins,
 * otherwise the listener stays attached to the (long-lived) AbortSignal and
 * accumulates across retries, eventually tripping Node's
 * `MaxListenersExceededWarning` after ~10 sleeps on the same signal.
 */
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onAbort = () => {
      if (timer) clearTimeout(timer);
      resolve();
    };
    timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

export interface BackoffOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  /** Honor Retry-After response header (in seconds). Set false for fixed schedule. */
  honorRetryAfter?: boolean;
  /** Reports the wait duration before each backoff sleep (UI/log surface). */
  onWait?: (waitMs: number, attempt: number) => void;
  signal?: AbortSignal;
}

interface RetryableError {
  status?: number;
  retryAfterMs?: number;
}

export function isRetryable(err: unknown): err is RetryableError {
  const e = err as { status?: number; response?: { status?: number } } | null;
  if (!e) return false;
  const status = e.status ?? e.response?.status;
  if (typeof status !== 'number') return false;
  return status === 429 || status === 503 || (status >= 500 && status < 600);
}

/**
 * Wraps an async fn with exponential backoff on 429/5xx. Re-throws non-retryable
 * errors immediately. After `maxRetries`, the last error is rethrown so the
 * caller can decide what to do (e.g. emit a recoverable SYNC_ERROR).
 */
export async function withBackoff<T>(
  fn: () => Promise<T>,
  opts: BackoffOptions = {}
): Promise<T> {
  const {
    maxRetries = 5,
    baseDelayMs = 1000,
    maxDelayMs = 32_000,
    honorRetryAfter = true,
    onWait,
    signal,
  } = opts;
  let attempt = 0;

  while (true) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    try {
      return await fn();
    } catch (err) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      if (!isRetryable(err) || attempt >= maxRetries) throw err;

      // Pull a server-suggested wait if the provider gave us one.
      const e = err as {
        retryAfterMs?: number;
        response?: { headers?: Record<string, string | string[] | undefined> };
      };
      let waitMs: number | null = null;
      if (honorRetryAfter) {
        if (typeof e.retryAfterMs === 'number') {
          waitMs = e.retryAfterMs;
        } else {
          const raw = e.response?.headers?.['retry-after'];
          const value = Array.isArray(raw) ? raw[0] : raw;
          const seconds = Number(value);
          if (Number.isFinite(seconds) && seconds > 0) {
            waitMs = seconds * 1000;
          }
        }
      }
      if (waitMs == null) {
        waitMs = Math.min(baseDelayMs * 2 ** attempt, maxDelayMs);
      }
      // Add ±20% jitter so concurrent workers don't synchronize their retries.
      waitMs = Math.floor(waitMs * (0.8 + Math.random() * 0.4));

      onWait?.(waitMs, attempt + 1);
      await sleep(waitMs, signal);
      attempt += 1;
    }
  }
}

/** Tiny semaphore for limiting concurrent in-flight requests in stage 2. */
export class ConcurrencyPool {
  private active = 0;
  private queue: Array<() => void> = [];

  constructor(private readonly limit: number) {}

  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.active >= this.limit) {
      await new Promise<void>((resolve) => this.queue.push(resolve));
    }
    this.active += 1;
    try {
      return await fn();
    } finally {
      this.active -= 1;
      const next = this.queue.shift();
      if (next) next();
    }
  }
}
