import axios, { AxiosError, AxiosInstance, AxiosRequestConfig } from 'axios';
import type {
  EmailMessage,
  EmailPreview,
  MailRule,
  FetchOptions,
  Folder,
  TimeRange,
} from '../../shared/types.js';
import { forceRefresh, getAccessToken } from './tokenManager.js';

const GMAIL = 'https://gmail.googleapis.com/gmail/v1/users/me';
const BATCH_URL = 'https://www.googleapis.com/batch/gmail/v1';

interface RetryConfig extends AxiosRequestConfig {
  __retry401?: boolean;
  __retry5xx?: boolean;
}

export class GmailClient {
  private http: AxiosInstance;
  private accountId: string;

  constructor(accountId: string) {
    this.accountId = accountId;
    this.http = axios.create({ baseURL: GMAIL, timeout: 30_000 });

    this.http.interceptors.request.use(async (cfg) => {
      const tok = await getAccessToken(accountId);
      cfg.headers.Authorization = `Bearer ${tok}`;
      return cfg;
    });

    this.http.interceptors.response.use(undefined, async (err: AxiosError) => {
      const status = err?.response?.status;
      const cfg = err?.config as RetryConfig | undefined;
      if (!cfg) return Promise.reject(err);

      // 401 → token may be revoked. Force-refresh and retry exactly once.
      if (status === 401 && !cfg.__retry401) {
        cfg.__retry401 = true;
        try {
          await forceRefresh(accountId);
        } catch (refreshErr) {
          return Promise.reject(refreshErr);
        }
        return this.http.request(cfg);
      }

      // 429 / 5xx → exponential-ish backoff (single retry).
      if (
        !cfg.__retry5xx &&
        (status === 429 || (typeof status === 'number' && status >= 500 && status < 600))
      ) {
        cfg.__retry5xx = true;
        const retryAfter = Number(err?.response?.headers?.['retry-after']);
        const wait = !Number.isNaN(retryAfter) && retryAfter > 0
          ? retryAfter * 1000
          : 800 + Math.random() * 1200;
        await new Promise((r) => setTimeout(r, wait));
        return this.http.request(cfg);
      }
      return Promise.reject(err);
    });
  }

  // ─── Reads ────────────────────────────────────────────────────────────

  async getProfile(): Promise<{ emailAddress: string; messagesTotal: number; threadsTotal: number }> {
    const resp = await this.http.get('/profile');
    return resp.data;
  }

  /** Quick estimate of how many messages match a range — does not enumerate. */
  async probeRange(range: TimeRange): Promise<number> {
    const q = buildQueryForRange(range);
    const resp = await this.http.get<{ resultSizeEstimate?: number }>('/messages', {
      params: { maxResults: 1, q: q || undefined },
    });
    return resp.data.resultSizeEstimate ?? 0;
  }

  async listMessageIds(opts: FetchOptions = {}): Promise<string[]> {
    const ids: string[] = [];
    const max = opts.maxMessages ?? 5000;

    const q: string[] = [];
    if (opts.range) {
      const built = buildQueryForRange(opts.range);
      if (built) q.push(built);
    }
    if (opts.unreadOnly) q.push('is:unread');
    if (opts.labelOrFolder && opts.labelOrFolder !== 'INBOX') {
      q.push(`label:${opts.labelOrFolder}`);
    }
    const query = q.join(' ');

    let pageToken: string | undefined;
    do {
      const resp = await this.http.get<{
        messages?: Array<{ id: string }>;
        nextPageToken?: string;
      }>('/messages', {
        params: {
          maxResults: 500,
          pageToken,
          q: query || undefined,
          labelIds: opts.labelOrFolder === 'INBOX' ? 'INBOX' : undefined,
        },
      });
      for (const m of resp.data.messages ?? []) {
        ids.push(m.id);
        if (ids.length >= max) return ids;
      }
      pageToken = resp.data.nextPageToken;
    } while (pageToken);
    return ids;
  }

  async getMessageMetadata(id: string): Promise<EmailMessage | null> {
    try {
      const resp = await this.http.get<GmailMessageRaw>(`/messages/${id}`, {
        params: {
          format: 'metadata',
          metadataHeaders: ['From', 'Subject', 'List-Unsubscribe', 'Date'],
        },
      });
      return rawToMessage(resp.data);
    } catch {
      return null;
    }
  }

  /** Full message for the mailbox reading pane. */
  async getMessagePreview(id: string): Promise<EmailPreview | null> {
    try {
      const resp = await this.http.get<GmailMessageRaw>(`/messages/${id}`, {
        params: { format: 'full' },
      });
      const msg = rawToMessage(resp.data);
      const { html, text } = extractGmailBody(resp.data.payload);
      return {
        id: msg.id,
        subject: msg.subject,
        fromEmail: msg.fromEmail,
        fromName: msg.fromName,
        receivedAt: msg.receivedAt,
        isUnread: msg.isUnread,
        snippet: msg.snippet,
        bodyHtml: html,
        bodyText: text ?? msg.snippet,
      };
    } catch {
      return null;
    }
  }

  /**
   * Bulk metadata fetch via Gmail's HTTP /batch endpoint.
   * Up to 100 sub-requests per HTTP call → 100x fewer round-trips than per-id GETs.
   * (Quota cost is unchanged — 5 units/message — but wall-clock time is dramatically reduced.)
   */
  async getMessagesBatch(
    ids: string[],
    onOne?: (m: EmailMessage) => void
  ): Promise<EmailMessage[]> {
    const out: EmailMessage[] = [];
    if (ids.length === 0) return out;

    const CHUNK = 100;
    const chunks: string[][] = [];
    for (let i = 0; i < ids.length; i += CHUNK) chunks.push(ids.slice(i, i + CHUNK));

    // Run a small number of batch requests in parallel to amortize TLS round-trips
    // without breaching Gmail's 250 quota-units/sec budget.
    const PARALLEL = 3;
    let next = 0;
    const workers = Array.from({ length: PARALLEL }, async () => {
      while (true) {
        const idx = next++;
        if (idx >= chunks.length) return;
        const chunk = chunks[idx];
        try {
          const messages = await this.batchGetMetadata(chunk);
          for (const m of messages) {
            if (m) {
              out.push(m);
              onOne?.(m);
            }
          }
        } catch {
          // Fall back to per-id fetch for this chunk.
          for (const id of chunk) {
            const m = await this.getMessageMetadata(id);
            if (m) {
              out.push(m);
              onOne?.(m);
            }
          }
        }
        // Friendly pacing between batch calls.
        await new Promise((r) => setTimeout(r, 100));
      }
    });
    await Promise.all(workers);
    return out;
  }

  private async batchGetMetadata(ids: string[]): Promise<Array<EmailMessage | null>> {
    const boundary = `batch_${Math.random().toString(36).slice(2)}`;
    const headerHmac = ['From', 'Subject', 'List-Unsubscribe', 'Date']
      .map((h) => `metadataHeaders=${encodeURIComponent(h)}`)
      .join('&');
    const body =
      ids
        .map((id, i) => {
          const path = `/gmail/v1/users/me/messages/${id}?format=metadata&${headerHmac}`;
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

    const tok = await getAccessToken(this.accountId);
    let resp;
    try {
      resp = await axios.post<string>(BATCH_URL, body, {
        headers: {
          Authorization: `Bearer ${tok}`,
          'Content-Type': `multipart/mixed; boundary=${boundary}`,
        },
        responseType: 'text',
        transformResponse: (x) => x as string,
        timeout: 60_000,
      });
    } catch (e) {
      if ((e as AxiosError)?.response?.status === 401) {
        await forceRefresh(this.accountId);
        const tok2 = await getAccessToken(this.accountId);
        resp = await axios.post<string>(BATCH_URL, body, {
          headers: {
            Authorization: `Bearer ${tok2}`,
            'Content-Type': `multipart/mixed; boundary=${boundary}`,
          },
          responseType: 'text',
          transformResponse: (x) => x as string,
          timeout: 60_000,
        });
      } else {
        throw e;
      }
    }

    const ct = resp.headers['content-type'];
    return parseMultipartBatchResponse(resp.data, typeof ct === 'string' ? ct : '');
  }

  // ─── Writes ──────────────────────────────────────────────────────────

  async trashMessage(id: string): Promise<void> {
    await this.http.post(`/messages/${id}/trash`);
  }

  async untrashMessage(id: string): Promise<void> {
    await this.http.post(`/messages/${id}/untrash`);
  }

  async deleteMessage(id: string): Promise<void> {
    await this.http.delete(`/messages/${id}`);
  }

  /**
   * Bulk trash/restore via Gmail's batchModify endpoint.
   * Accepts up to 1000 ids per call — ~1000× faster than per-message /trash.
   */
  async batchTrash(ids: string[]): Promise<void> {
    const CHUNK = 1000;
    for (let i = 0; i < ids.length; i += CHUNK) {
      const slice = ids.slice(i, i + CHUNK);
      await this.http.post('/messages/batchModify', {
        ids: slice,
        addLabelIds: ['TRASH'],
        removeLabelIds: ['INBOX'],
      });
    }
  }

  /**
   * Permanently delete messages — bypasses Trash. Used when the user has
   * `deletionMode: 'permanent'` in Settings. Gmail's batchDelete tops out at
   * 1000 ids per call. Closes audit P0-3c (suggestion apply now honors mode).
   */
  async batchPermanentDelete(ids: string[]): Promise<void> {
    const CHUNK = 1000;
    for (let i = 0; i < ids.length; i += CHUNK) {
      const slice = ids.slice(i, i + CHUNK);
      await this.http.post('/messages/batchDelete', { ids: slice });
    }
  }

  async batchUntrash(ids: string[]): Promise<void> {
    const CHUNK = 1000;
    for (let i = 0; i < ids.length; i += CHUNK) {
      const slice = ids.slice(i, i + CHUNK);
      await this.http.post('/messages/batchModify', {
        ids: slice,
        addLabelIds: ['INBOX'],
        removeLabelIds: ['TRASH'],
      });
    }
  }

  async batchModifyLabels(
    ids: string[],
    addLabelIds: string[],
    removeLabelIds: string[]
  ): Promise<void> {
    const CHUNK = 1000;
    for (let i = 0; i < ids.length; i += CHUNK) {
      const slice = ids.slice(i, i + CHUNK);
      await this.http.post('/messages/batchModify', {
        ids: slice,
        addLabelIds,
        removeLabelIds,
      });
    }
  }

  /** Apply / remove labels (Gmail equivalent of "move to folder"). */
  async modifyLabels(
    id: string,
    addLabelIds: string[],
    removeLabelIds: string[] = []
  ): Promise<void> {
    await this.http.post(`/messages/${id}/modify`, { addLabelIds, removeLabelIds });
  }

  // ─── Folders / labels ────────────────────────────────────────────────

  async listLabels(): Promise<Folder[]> {
    const resp = await this.http.get<{
      labels: Array<{
        id: string;
        name: string;
        type: 'system' | 'user';
        messagesTotal?: number;
        messagesUnread?: number;
        color?: { backgroundColor?: string; textColor?: string };
      }>;
    }>('/labels');
    return (resp.data.labels ?? []).map((l) => ({
      id: l.id,
      name:
        l.id === 'INBOX'
          ? 'Inbox'
          : l.id === 'SPAM'
            ? 'Junk/Spam'
            : l.name,
      count: l.messagesTotal,
      color: l.color?.backgroundColor,
      isSystem: l.type === 'system',
    }));
  }

  async createLabel(name: string, color?: string): Promise<Folder> {
    const body: Record<string, unknown> = {
      name,
      labelListVisibility: 'labelShow',
      messageListVisibility: 'show',
    };
    if (color) body.color = { backgroundColor: color, textColor: '#ffffff' };
    const resp = await this.http.post<{ id: string; name: string }>('/labels', body);
    return { id: resp.data.id, name: resp.data.name, color };
  }

  // ─── Filters / rules ─────────────────────────────────────────────────

  async listFilters(): Promise<MailRule[]> {
    const resp = await this.http.get<{
      filter?: Array<{
        id: string;
        criteria?: { from?: string; subject?: string; query?: string; hasAttachment?: boolean };
        action?: { addLabelIds?: string[]; removeLabelIds?: string[]; forward?: string };
      }>;
    }>('/settings/filters');
    return (resp.data.filter ?? []).map((f) => ({
      id: `gmail-${f.id}`,
      providerRuleId: f.id,
      source: 'remote' as const,
      fromContains: f.criteria?.from,
      subjectContains: f.criteria?.subject,
      bodyContains: f.criteria?.query,
      hasAttachment: f.criteria?.hasAttachment,
      addLabel: f.action?.addLabelIds?.find(
        (l) => l !== 'TRASH' && l !== 'INBOX' && l !== 'UNREAD'
      ),
      removeLabel: f.action?.removeLabelIds?.find((l) => l !== 'INBOX' && l !== 'UNREAD'),
      archive: (f.action?.removeLabelIds ?? []).includes('INBOX'),
      delete: (f.action?.addLabelIds ?? []).includes('TRASH'),
      markRead: (f.action?.removeLabelIds ?? []).includes('UNREAD'),
      forwardTo: f.action?.forward,
      enabled: true,
      createdAt: Date.now(),
    }));
  }

  async createFilter(rule: MailRule): Promise<MailRule> {
    const criteria: Record<string, unknown> = {};
    if (rule.fromContains) criteria.from = rule.fromContains;
    if (rule.subjectContains) criteria.subject = rule.subjectContains;
    if (rule.bodyContains) criteria.query = rule.bodyContains;
    if (rule.hasAttachment) criteria.hasAttachment = true;

    const action: Record<string, unknown> = {};
    const add: string[] = [];
    const remove: string[] = [];
    if (rule.addLabel) add.push(rule.addLabel);
    if (rule.delete) add.push('TRASH');
    if (rule.archive) remove.push('INBOX');
    if (rule.markRead) remove.push('UNREAD');
    if (add.length) action.addLabelIds = add;
    if (remove.length) action.removeLabelIds = remove;
    if (rule.forwardTo) action.forward = rule.forwardTo;

    const resp = await this.http.post<{ id: string }>('/settings/filters', { criteria, action });
    return { ...rule, providerRuleId: resp.data.id, source: 'remote' };
  }

  async deleteFilter(providerRuleId: string): Promise<void> {
    await this.http.delete(`/settings/filters/${providerRuleId}`);
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────

interface GmailMessageRaw {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet: string;
  sizeEstimate: number;
  internalDate: string;
  payload?: GmailPart;
}

interface GmailPart {
  mimeType?: string;
  headers?: Array<{ name: string; value: string }>;
  body?: { data?: string; size?: number };
  parts?: GmailPart[];
}

function decodeBase64Url(data: string): string {
  const b64 = data.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(b64, 'base64').toString('utf8');
}

function extractGmailBody(payload?: GmailPart): { html?: string; text?: string } {
  let html: string | undefined;
  let text: string | undefined;

  const walk = (part: GmailPart) => {
    if (part.mimeType === 'text/html' && part.body?.data && !html) {
      html = decodeBase64Url(part.body.data);
    } else if (part.mimeType === 'text/plain' && part.body?.data && !text) {
      text = decodeBase64Url(part.body.data);
    }
    for (const p of part.parts ?? []) walk(p);
  };

  if (payload) walk(payload);
  return { html, text };
}

function rawToMessage(m: GmailMessageRaw): EmailMessage {
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
    snippet: m.snippet,
    receivedAt: Number(m.internalDate),
    sizeBytes: m.sizeEstimate ?? 0,
    isUnread: (m.labelIds ?? []).includes('UNREAD'),
    hasListUnsubscribe: !!unsub,
    listUnsubscribeValue: unsub,
    labelIds: m.labelIds,
    folder: (m.labelIds ?? [])[0],
  };
}

function buildQueryForRange(range: TimeRange): string {
  if (range.key === 'all' && !range.startMs) return '';
  const fmt = (ms: number) => {
    const d = new Date(ms);
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(
      d.getDate()
    ).padStart(2, '0')}`;
  };
  const parts: string[] = [];
  if (range.startMs) parts.push(`after:${fmt(range.startMs)}`);
  if (range.endMs && range.endMs < Date.now() - 86400_000)
    parts.push(`before:${fmt(range.endMs)}`);
  return parts.join(' ');
}

function parseFromHeader(raw: string): { name: string; email: string } {
  const m = raw.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  if (m) return { name: m[1].trim(), email: m[2].trim().toLowerCase() };
  const email = raw.trim().replace(/[<>]/g, '').toLowerCase();
  return { name: email.split('@')[0], email };
}

/**
 * Parses a multipart/mixed Gmail batch response into ordered message metadata.
 * Each part is `application/http` containing a complete HTTP/1.1 response from a sub-request.
 */
function parseMultipartBatchResponse(
  body: string,
  contentType: string
): Array<EmailMessage | null> {
  const m = /boundary=([^;]+)/.exec(contentType);
  if (!m) return [];
  const boundary = m[1].trim().replace(/^"|"$/g, '');
  const parts = body.split(`--${boundary}`).slice(1, -1);

  const out: Array<EmailMessage | null> = [];
  for (const part of parts) {
    // Split outer headers from inner HTTP response.
    const innerStart = part.indexOf('\r\n\r\n');
    if (innerStart < 0) {
      out.push(null);
      continue;
    }
    const inner = part.slice(innerStart + 4);
    // Split status+headers from body of the inner HTTP response.
    const bodyStart = inner.indexOf('\r\n\r\n');
    if (bodyStart < 0) {
      out.push(null);
      continue;
    }
    const statusLine = inner.split('\r\n')[0] ?? '';
    const statusOK = /HTTP\/\S+\s+2\d\d/.test(statusLine);
    if (!statusOK) {
      out.push(null);
      continue;
    }
    const json = inner.slice(bodyStart + 4).trim();
    try {
      const obj = JSON.parse(json) as GmailMessageRaw;
      out.push(rawToMessage(obj));
    } catch {
      out.push(null);
    }
  }
  return out;
}
