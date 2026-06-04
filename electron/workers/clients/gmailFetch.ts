// Worker-side Gmail HTTP client — no Electron / keytar dependencies.
//
// Differences from electron/services/gmail.ts:
// - Token getter is injected (proxies to main via parentPort).
// - 401 retry calls the same proxy to ask main to refresh.
// - Uses the formal `withBackoff` helper instead of single-shot retry.
// - Yields each page of IDs so callers can persist a cursor and stream
//   metadata to SQLite without buffering the full mailbox.

import axios, { AxiosError, AxiosInstance, AxiosRequestConfig } from 'axios';
import type { TimeRange } from '../../../shared/types.js';
import { withBackoff, sleep } from '../backoff.js';

const GMAIL = 'https://gmail.googleapis.com/gmail/v1/users/me';
const BATCH_URL = 'https://www.googleapis.com/batch/gmail/v1';

interface RetryConfig extends AxiosRequestConfig {
  __retry401?: boolean;
}

export interface GmailFetchOptions {
  range?: TimeRange;
  unreadOnly?: boolean;
  labelOrFolder?: string;
  /** Optional incremental anchor — Gmail "after:" date (epoch ms). */
  afterMs?: number;
  signal?: AbortSignal;
}

export interface GmailMetadataRow {
  id: string;
  threadId?: string;
  fromEmail: string;
  fromName: string;
  subject: string;
  receivedAt: number;
  sizeBytes: number;
  isUnread: boolean;
  hasListUnsubscribe: boolean;
  listUnsubscribeValue?: string;
  folderId?: string;
}

export class GmailFetcher {
  private http: AxiosInstance;

  constructor(
    private readonly accountId: string,
    private getToken: () => Promise<string>,
    private refreshToken: () => Promise<string>,
    private readonly logger?: (line: string) => void
  ) {
    this.http = axios.create({ baseURL: GMAIL, timeout: 30_000 });
    this.http.interceptors.request.use(async (cfg) => {
      const tok = await this.getToken();
      cfg.headers.Authorization = `Bearer ${tok}`;
      return cfg;
    });
    this.http.interceptors.response.use(undefined, async (err: AxiosError) => {
      const cfg = err.config as RetryConfig | undefined;
      if (!cfg) return Promise.reject(err);
      if (err.response?.status === 401 && !cfg.__retry401) {
        cfg.__retry401 = true;
        await this.refreshToken();
        return this.http.request(cfg);
      }
      return Promise.reject(err);
    });
  }

  async getProfile(): Promise<{ emailAddress: string; messagesTotal: number }> {
    const r = await withBackoff(
      () => this.http.get('/profile'),
      { onWait: this.warnRateLimit('profile') }
    );
    return r.data;
  }

  async probeRange(range: TimeRange): Promise<number> {
    const q = buildQueryForRange(range);
    const r = await withBackoff(
      () =>
        this.http.get<{ resultSizeEstimate?: number }>('/messages', {
          params: { maxResults: 1, q: q || undefined },
        }),
      { onWait: this.warnRateLimit('probe') }
    );
    return r.data.resultSizeEstimate ?? 0;
  }

  async listLabels(): Promise<Array<{ id: string; name: string; type?: string }>> {
    const r = await withBackoff(() => this.http.get('/labels'), {
      onWait: this.warnRateLimit('labels'),
    });
    return (r.data?.labels ?? []) as Array<{ id: string; name: string; type?: string }>;
  }

  /**
   * Generator of ID pages. Yields after each page so the caller can persist
   * the page token as a resumable cursor, fetch metadata, and write to DB
   * before pulling the next page.
   */
  async *streamMessageIds(
    opts: GmailFetchOptions,
    initialCursor?: string | null
  ): AsyncGenerator<{ ids: string[]; nextCursor: string | null }> {
    const q: string[] = [];
    if (opts.range) {
      const built = buildQueryForRange(opts.range);
      if (built) q.push(built);
    }
    if (opts.afterMs) q.push(`after:${gmailDate(opts.afterMs)}`);
    if (opts.unreadOnly) q.push('is:unread');
    if (opts.labelOrFolder && opts.labelOrFolder !== 'INBOX') {
      q.push(`label:${opts.labelOrFolder}`);
    }
    const query = q.join(' ');

    let pageToken: string | undefined = initialCursor ?? undefined;
    do {
      if (opts.signal?.aborted) return;
      const resp = await withBackoff(
        () =>
          this.http.get<{
            messages?: Array<{ id: string }>;
            nextPageToken?: string;
          }>('/messages', {
            params: {
              maxResults: 500,
              pageToken,
              q: query || undefined,
              labelIds: opts.labelOrFolder === 'INBOX' ? 'INBOX' : undefined,
            },
          }),
        { onWait: this.warnRateLimit('list-ids'), signal: opts.signal }
      );
      const ids = (resp.data.messages ?? []).map((m) => m.id);
      pageToken = resp.data.nextPageToken;
      yield { ids, nextCursor: pageToken ?? null };
    } while (pageToken);
  }

  /**
   * Fetch metadata for a chunk of IDs in a single multipart batch HTTP call.
   * Up to 100 IDs per call (Gmail API limit). Returns rows in the same order
   * as input ids (with nulls for sub-request failures).
   */
  async batchGetMetadata(
    ids: string[],
    signal?: AbortSignal
  ): Promise<Array<GmailMetadataRow | null>> {
    if (ids.length === 0) return [];
    if (ids.length > 100) {
      throw new Error(`batchGetMetadata: max 100 ids per call, got ${ids.length}`);
    }
    const boundary = `batch_${Math.random().toString(36).slice(2)}`;
    const headerParam = ['From', 'Subject', 'List-Unsubscribe', 'Date', 'X-Mailer']
      .map((h) => `metadataHeaders=${encodeURIComponent(h)}`)
      .join('&');
    const body =
      ids
        .map((id, i) => {
          const path = `/gmail/v1/users/me/messages/${id}?format=metadata&${headerParam}`;
          return [
            `--${boundary}`,
            'Content-Type: application/http',
            `Content-ID: <item-${i}>`,
            '',
            `GET ${path}`,
            '',
          ].join('\r\n');
        })
        .join('\r\n') + `\r\n--${boundary}--\r\n`;

    const post = async () => {
      const tok = await this.getToken();
      return axios.post<string>(BATCH_URL, body, {
        headers: {
          Authorization: `Bearer ${tok}`,
          'Content-Type': `multipart/mixed; boundary=${boundary}`,
        },
        responseType: 'text',
        transformResponse: (x) => x as string,
        timeout: 60_000,
        signal,
      });
    };

    let resp;
    try {
      resp = await withBackoff(post, {
        onWait: this.warnRateLimit('batch'),
        signal,
      });
    } catch (e) {
      if ((e as AxiosError)?.response?.status === 401) {
        await this.refreshToken();
        resp = await withBackoff(post, {
          onWait: this.warnRateLimit('batch'),
          signal,
        });
      } else {
        throw e;
      }
    }
    const ct = (resp.headers['content-type'] as string) ?? '';
    return parseMultipart(resp.data, ct, ids);
  }

  private warnRateLimit(label: string) {
    return (waitMs: number, attempt: number) => {
      this.logger?.(
        `Gmail ${label}: rate-limited — waiting ${(waitMs / 1000).toFixed(1)}s (attempt ${attempt})`
      );
    };
  }
}

function gmailDate(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

function buildQueryForRange(range: TimeRange): string {
  if (range.key === 'all' && !range.startMs) return '';
  const parts: string[] = [];
  if (range.startMs) parts.push(`after:${gmailDate(range.startMs)}`);
  if (range.endMs && range.endMs < Date.now() - 86400_000)
    parts.push(`before:${gmailDate(range.endMs)}`);
  return parts.join(' ');
}

function parseFromHeader(raw: string): { name: string; email: string } {
  const m = raw.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  if (m) return { name: m[1].trim(), email: m[2].trim().toLowerCase() };
  const email = raw.trim().replace(/[<>]/g, '').toLowerCase();
  return { name: email.split('@')[0], email };
}

interface RawGmailMessage {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet?: string;
  sizeEstimate?: number;
  internalDate?: string;
  payload?: { headers?: Array<{ name: string; value: string }> };
}

function rawToRow(m: RawGmailMessage): GmailMetadataRow {
  const headers = new Map(
    (m.payload?.headers ?? []).map((h) => [h.name.toLowerCase(), h.value])
  );
  const from = headers.get('from') ?? '';
  const subject = headers.get('subject') ?? '(no subject)';
  const unsub = headers.get('list-unsubscribe');
  const { name, email } = parseFromHeader(from);
  return {
    id: m.id,
    threadId: m.threadId,
    fromEmail: email,
    fromName: name,
    subject,
    receivedAt: Number(m.internalDate ?? Date.now()),
    sizeBytes: m.sizeEstimate ?? 0,
    isUnread: (m.labelIds ?? []).includes('UNREAD'),
    hasListUnsubscribe: !!unsub,
    listUnsubscribeValue: unsub,
    folderId: (m.labelIds ?? [])[0],
  };
}

function parseMultipart(
  body: string,
  contentType: string,
  inputIds: string[]
): Array<GmailMetadataRow | null> {
  const m = /boundary=([^;]+)/.exec(contentType);
  if (!m) return inputIds.map(() => null);
  const boundary = m[1].trim().replace(/^"|"$/g, '');
  const parts = body.split(`--${boundary}`).slice(1, -1);
  const out: Array<GmailMetadataRow | null> = [];
  for (const part of parts) {
    const innerStart = part.indexOf('\r\n\r\n');
    if (innerStart < 0) {
      out.push(null);
      continue;
    }
    const inner = part.slice(innerStart + 4);
    const bodyStart = inner.indexOf('\r\n\r\n');
    if (bodyStart < 0) {
      out.push(null);
      continue;
    }
    const statusLine = inner.split('\r\n')[0] ?? '';
    if (!/HTTP\/\S+\s+2\d\d/.test(statusLine)) {
      out.push(null);
      continue;
    }
    const json = inner.slice(bodyStart + 4).trim();
    try {
      out.push(rawToRow(JSON.parse(json)));
    } catch {
      out.push(null);
    }
  }
  while (out.length < inputIds.length) out.push(null);
  return out;
}

export { sleep };
