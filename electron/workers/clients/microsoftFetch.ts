// Worker-side Microsoft Graph fetcher with $batch support.
//
// The big architectural change vs electron/services/microsoft.ts is the
// addition of the JSON $batch endpoint. Listing returns IDs only; we then
// fan out detail requests in batches of up to 20 sub-requests per HTTP call.
// This is the difference between O(N) and O(N/20) round-trips for stage 2.

import axios, { AxiosError, AxiosInstance, AxiosRequestConfig } from 'axios';
import type { TimeRange } from '../../../shared/types.js';
import { withBackoff } from '../backoff.js';

const GRAPH = 'https://graph.microsoft.com/v1.0';
const BATCH_URL = `${GRAPH}/$batch`;

interface RetryConfig extends AxiosRequestConfig {
  __retry401?: boolean;
}

export interface GraphFetchOptions {
  range?: TimeRange;
  unreadOnly?: boolean;
  labelOrFolder?: string;
  /** Optional incremental anchor — only return messages newer than this. */
  afterMs?: number;
  signal?: AbortSignal;
}

export interface GraphMetadataRow {
  id: string;
  fromEmail: string;
  fromName: string;
  subject: string;
  bodyPreview: string;
  receivedAt: number;
  sizeBytes: number;
  isUnread: boolean;
  hasListUnsubscribe: boolean;
  listUnsubscribeValue?: string;
  folderId?: string;
  hasAttachments?: boolean;
  xMailer?: string;
}

export class GraphFetcher {
  private http: AxiosInstance;

  constructor(
    private readonly accountId: string,
    private getToken: () => Promise<string>,
    private refreshToken: () => Promise<string>,
    private readonly logger?: (line: string) => void
  ) {
    this.http = axios.create({ baseURL: GRAPH, timeout: 30_000 });
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

  async getProfile(): Promise<{ id: string; mail?: string; userPrincipalName?: string }> {
    const r = await withBackoff(() => this.http.get('/me'), {
      onWait: this.warnRateLimit('profile'),
    });
    return r.data;
  }

  async probeRange(range: TimeRange): Promise<number> {
    const filter = buildFilterForRange(range);
    const r = await withBackoff(
      () =>
        this.http.get<{ '@odata.count': number }>(
          `/me/messages/$count${filter ? `?$filter=${encodeURIComponent(filter)}` : ''}`,
          {
            headers: { ConsistencyLevel: 'eventual' },
            transformResponse: (raw) => {
              const n =
                typeof raw === 'string'
                  ? Number(raw)
                  : Number((raw as { count?: number })?.count);
              return Number.isFinite(n) ? { '@odata.count': n } : { '@odata.count': 0 };
            },
          }
        ),
      { onWait: this.warnRateLimit('probe') }
    );
    return r.data['@odata.count'] ?? 0;
  }

  async listMailFolders(): Promise<Array<{ id: string; displayName: string }>> {
    const out: Array<{ id: string; displayName: string }> = [];
    let url: string | undefined =
      '/me/mailFolders?$top=200&$select=id,displayName,parentFolderId,totalItemCount';
    while (url) {
      const resp = await withBackoff<{
        data: {
          value: Array<{ id: string; displayName: string }>;
          '@odata.nextLink'?: string;
        };
      }>(() => this.http.get(url!) as Promise<{
        data: {
          value: Array<{ id: string; displayName: string }>;
          '@odata.nextLink'?: string;
        };
      }>, { onWait: this.warnRateLimit('folders') });
      for (const f of resp.data.value) out.push(f);
      const next = resp.data['@odata.nextLink'];
      url = next ? next.replace(GRAPH, '') : undefined;
    }
    return out;
  }

  /**
   * Streams pages of message IDs (id only — no detail). Each yield includes
   * the rewritten nextLink so the caller can persist a cursor.
   */
  async *streamMessageIds(
    opts: GraphFetchOptions,
    initialCursor?: string | null
  ): AsyncGenerator<{ ids: string[]; nextCursor: string | null }> {
    const filter: string[] = [];
    if (opts.unreadOnly) filter.push('isRead eq false');
    if (opts.range) {
      const built = buildFilterForRange(opts.range);
      if (built) filter.push(built);
    }
    if (opts.afterMs) {
      filter.push(`receivedDateTime ge ${new Date(opts.afterMs).toISOString()}`);
    }
    const folder =
      opts.labelOrFolder && opts.labelOrFolder !== 'INBOX'
        ? `/me/mailFolders/${encodeURIComponent(opts.labelOrFolder)}/messages`
        : '/me/messages';

    let url: string | undefined =
      initialCursor ??
      `${folder}?$top=200&$select=id&$orderby=receivedDateTime desc${
        filter.length ? `&$filter=${encodeURIComponent(filter.join(' and '))}` : ''
      }`;

    while (url) {
      if (opts.signal?.aborted) return;
      const resp = await withBackoff<{
        data: {
          value: Array<{ id: string }>;
          '@odata.nextLink'?: string;
        };
      }>(
        () =>
          this.http.get(url!) as Promise<{
            data: { value: Array<{ id: string }>; '@odata.nextLink'?: string };
          }>,
        { onWait: this.warnRateLimit('list-ids'), signal: opts.signal }
      );
      const ids = resp.data.value.map((m) => m.id);
      const next = resp.data['@odata.nextLink'];
      url = next ? next.replace(GRAPH, '') : undefined;
      yield { ids, nextCursor: url ?? null };
    }
  }

  /**
   * JSON $batch — up to 20 GETs per HTTP call. Returns rows in the same order
   * as input ids (with nulls for sub-request failures).
   *
   * Docs: https://learn.microsoft.com/en-us/graph/json-batching
   */
  async batchGetMetadata(
    ids: string[],
    signal?: AbortSignal
  ): Promise<Array<GraphMetadataRow | null>> {
    if (ids.length === 0) return [];
    if (ids.length > 20) {
      throw new Error(`Graph $batch supports max 20 sub-requests, got ${ids.length}`);
    }
    const select =
      'id,from,subject,bodyPreview,receivedDateTime,isRead,hasAttachments,parentFolderId,internetMessageHeaders';
    const requests = ids.map((id, i) => ({
      id: String(i),
      method: 'GET',
      url: `/me/messages/${id}?$select=${encodeURIComponent(select)}`,
    }));

    const post = () =>
      this.http.post<{
        responses: Array<{
          id: string;
          status: number;
          headers?: Record<string, string>;
          body?: GraphMessageRaw | { error?: { message?: string; code?: string } };
        }>;
      }>(
        '/$batch',
        { requests },
        { signal, baseURL: GRAPH }
      );

    let resp;
    try {
      resp = await withBackoff(post, {
        onWait: this.warnRateLimit('$batch'),
        signal,
      });
    } catch (e) {
      if ((e as AxiosError)?.response?.status === 401) {
        await this.refreshToken();
        resp = await withBackoff(post, {
          onWait: this.warnRateLimit('$batch'),
          signal,
        });
      } else {
        throw e;
      }
    }

    const out: Array<GraphMetadataRow | null> = ids.map(() => null);
    let topRetry = 0;
    for (const r of resp.data.responses) {
      const idx = Number(r.id);
      if (!Number.isInteger(idx) || idx < 0 || idx >= ids.length) continue;
      // Sub-request rate limited — surface it; outer caller handles retry of
      // the chunk if too many fail in one batch.
      if (r.status === 429 || r.status === 503) {
        topRetry += 1;
        continue;
      }
      if (r.status >= 200 && r.status < 300 && r.body) {
        const body = r.body as GraphMessageRaw;
        out[idx] = rawToRow(body);
      }
      // Other non-2xx → leave null; the per-item fallback will handle it.
    }
    if (topRetry > 0) {
      this.logger?.(`Graph $batch: ${topRetry} sub-requests rate-limited (will retry next pass)`);
    }
    return out;
  }

  /**
   * Per-id fallback for sub-request failures inside a $batch. Used sparingly.
   */
  async getMetadataOne(id: string, signal?: AbortSignal): Promise<GraphMetadataRow | null> {
    try {
      const select =
        'id,from,subject,bodyPreview,receivedDateTime,isRead,hasAttachments,parentFolderId,internetMessageHeaders';
      const r = await withBackoff(
        () =>
          this.http.get<GraphMessageRaw>(`/me/messages/${id}`, {
            params: { $select: select },
            signal,
          }),
        { onWait: this.warnRateLimit('one'), signal }
      );
      return rawToRow(r.data);
    } catch {
      return null;
    }
  }

  private warnRateLimit(label: string) {
    return (waitMs: number, attempt: number) => {
      this.logger?.(
        `Graph ${label}: rate-limited — waiting ${(waitMs / 1000).toFixed(1)}s (attempt ${attempt})`
      );
    };
  }
}

interface GraphMessageRaw {
  id: string;
  from?: { emailAddress?: { address?: string; name?: string } };
  subject?: string;
  bodyPreview?: string;
  receivedDateTime?: string;
  isRead?: boolean;
  internetMessageHeaders?: Array<{ name: string; value: string }>;
  parentFolderId?: string;
  hasAttachments?: boolean;
}

function rawToRow(m: GraphMessageRaw): GraphMetadataRow {
  const fromAddr = (m.from?.emailAddress?.address ?? '').toLowerCase();
  const fromName = m.from?.emailAddress?.name ?? fromAddr.split('@')[0];
  const headers = m.internetMessageHeaders ?? [];
  const hUnsub = headers.find((h) => h.name.toLowerCase() === 'list-unsubscribe');
  const hMailer = headers.find((h) => h.name.toLowerCase() === 'x-mailer');
  return {
    id: m.id,
    fromEmail: fromAddr,
    fromName,
    subject: m.subject ?? '(no subject)',
    bodyPreview: m.bodyPreview ?? '',
    receivedAt: m.receivedDateTime ? new Date(m.receivedDateTime).getTime() : Date.now(),
    sizeBytes: estimateSize(m),
    isUnread: !m.isRead,
    hasListUnsubscribe: !!hUnsub,
    listUnsubscribeValue: hUnsub?.value,
    folderId: m.parentFolderId,
    hasAttachments: m.hasAttachments,
    xMailer: hMailer?.value,
  };
}

function estimateSize(m: GraphMessageRaw): number {
  // Graph doesn't return an authoritative size with our $select. We
  // synthesize a heuristic from headers + body preview + attachment fudge.
  // Worst-case error ≈ a few hundred KB for huge attachments — acceptable
  // for storage-tally and ranking purposes.
  const headerBytes = (m.internetMessageHeaders ?? []).reduce(
    (a, h) => a + h.name.length + (h.value?.length ?? 0) + 4,
    0
  );
  const subjectBytes = (m.subject ?? '').length;
  const previewBytes = (m.bodyPreview ?? '').length;
  const bodyEstimate = previewBytes * 8;
  const attachFudge = m.hasAttachments ? 200_000 : 0;
  return headerBytes + subjectBytes + bodyEstimate + attachFudge + 1024;
}

function buildFilterForRange(range: TimeRange): string {
  if (range.key === 'all' && !range.startMs) return '';
  const parts: string[] = [];
  if (range.startMs) parts.push(`receivedDateTime ge ${new Date(range.startMs).toISOString()}`);
  if (range.endMs && range.endMs < Date.now() - 60_000) {
    parts.push(`receivedDateTime le ${new Date(range.endMs).toISOString()}`);
  }
  return parts.join(' and ');
}
