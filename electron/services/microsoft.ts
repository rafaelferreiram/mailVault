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

const GRAPH = 'https://graph.microsoft.com/v1.0';

interface RetryConfig extends AxiosRequestConfig {
  __retry401?: boolean;
  __retry5xx?: boolean;
}

export class GraphClient {
  private http: AxiosInstance;
  private accountId: string;

  constructor(accountId: string) {
    this.accountId = accountId;
    this.http = axios.create({ baseURL: GRAPH, timeout: 30_000 });

    this.http.interceptors.request.use(async (cfg) => {
      const tok = await getAccessToken(accountId);
      cfg.headers.Authorization = `Bearer ${tok}`;
      return cfg;
    });

    this.http.interceptors.response.use(undefined, async (err: AxiosError) => {
      const status = err?.response?.status;
      const cfg = err?.config as RetryConfig | undefined;
      if (!cfg) return Promise.reject(err);

      if (status === 401 && !cfg.__retry401) {
        cfg.__retry401 = true;
        try {
          await forceRefresh(accountId);
        } catch (refreshErr) {
          return Promise.reject(refreshErr);
        }
        return this.http.request(cfg);
      }

      if (
        !cfg.__retry5xx &&
        (status === 429 || (typeof status === 'number' && status >= 500 && status < 600))
      ) {
        cfg.__retry5xx = true;
        const retryAfter = Number(err?.response?.headers?.['retry-after']);
        const wait =
          !Number.isNaN(retryAfter) && retryAfter > 0
            ? retryAfter * 1000
            : 1000 + Math.random() * 1000;
        await new Promise((r) => setTimeout(r, wait));
        return this.http.request(cfg);
      }
      return Promise.reject(err);
    });
  }

  async getProfile(): Promise<{ id: string; mail?: string; userPrincipalName: string; displayName: string }> {
    const resp = await this.http.get('/me');
    return resp.data;
  }

  async probeRange(range: TimeRange): Promise<number> {
    const filter = buildFilterForRange(range);
    const resp = await this.http.get<{ '@odata.count': number }>(
      `/me/messages/$count${filter ? `?$filter=${encodeURIComponent(filter)}` : ''}`,
      {
        headers: { ConsistencyLevel: 'eventual' },
        // $count returns a plain integer, but Graph still wraps with metadata when not raw.
        // Using /$count returns raw int; axios parses to string in some cases.
        transformResponse: (r) => {
          const n = typeof r === 'string' ? Number(r) : Number((r as { count?: number })?.count);
          return Number.isFinite(n) ? { '@odata.count': n } : { '@odata.count': 0 };
        },
      }
    );
    return resp.data['@odata.count'] ?? 0;
  }

  async listMessages(
    opts: FetchOptions = {},
    onPage?: (count: number) => void
  ): Promise<EmailMessage[]> {
    const max = opts.maxMessages ?? 5000;
    const out: EmailMessage[] = [];

    const filter: string[] = [];
    if (opts.unreadOnly) filter.push('isRead eq false');
    if (opts.range) {
      const built = buildFilterForRange(opts.range);
      if (built) filter.push(built);
    }

    const folder =
      opts.labelOrFolder && opts.labelOrFolder !== 'INBOX'
        ? `/me/mailFolders/${encodeURIComponent(opts.labelOrFolder)}/messages`
        : '/me/messages';

    let url: string | undefined = `${folder}?$top=200&$select=id,from,subject,bodyPreview,receivedDateTime,isRead,internetMessageHeaders,parentFolderId,hasAttachments&$orderby=receivedDateTime desc${
      filter.length ? `&$filter=${encodeURIComponent(filter.join(' and '))}` : ''
    }`;

    while (url && out.length < max) {
      const resp: {
        data: { value: GraphMessage[]; '@odata.nextLink'?: string };
      } = await this.http.get(url);
      for (const m of resp.data.value) {
        const unsubHeader = (m.internetMessageHeaders ?? []).find(
          (h) => h.name.toLowerCase() === 'list-unsubscribe'
        );
        const fromEmail = (m.from?.emailAddress?.address ?? '').toLowerCase();
        const fromName = m.from?.emailAddress?.name ?? fromEmail.split('@')[0];
        out.push({
          id: m.id,
          fromEmail,
          fromName,
          subject: m.subject ?? '(no subject)',
          snippet: m.bodyPreview ?? '',
          receivedAt: m.receivedDateTime ? new Date(m.receivedDateTime).getTime() : Date.now(),
          sizeBytes: estimateMessageSize(m),
          isUnread: !m.isRead,
          hasListUnsubscribe: !!unsubHeader,
          listUnsubscribeValue: unsubHeader?.value,
          folder: m.parentFolderId,
        });
        if (out.length >= max) break;
      }
      onPage?.(out.length);
      const next = resp.data['@odata.nextLink'];
      url = next ? next.replace(GRAPH, '') : undefined;
    }
    return out;
  }

  async getMessagePreview(id: string): Promise<EmailPreview | null> {
    try {
      const resp = await this.http.get<{
        id: string;
        subject?: string;
        from?: { emailAddress?: { address?: string; name?: string } };
        receivedDateTime?: string;
        isRead?: boolean;
        bodyPreview?: string;
        body?: { contentType?: string; content?: string };
      }>(`/me/messages/${id}`, {
        params: { $select: 'id,subject,from,receivedDateTime,isRead,body,bodyPreview' },
      });
      const m = resp.data;
      const fromEmail = (m.from?.emailAddress?.address ?? '').toLowerCase();
      const fromName = m.from?.emailAddress?.name ?? fromEmail.split('@')[0];
      const content = m.body?.content ?? '';
      const isHtml = (m.body?.contentType ?? '').toLowerCase() === 'html';
      return {
        id: m.id,
        subject: m.subject ?? '(no subject)',
        fromEmail,
        fromName,
        receivedAt: m.receivedDateTime ? new Date(m.receivedDateTime).getTime() : Date.now(),
        isUnread: !m.isRead,
        snippet: m.bodyPreview ?? content.slice(0, 280),
        bodyHtml: isHtml ? content : undefined,
        bodyText: isHtml ? stripHtml(content) : content,
      };
    } catch {
      return null;
    }
  }

  async deleteMessage(id: string, mode: 'trash' | 'permanent'): Promise<void> {
    if (mode === 'permanent') {
      await this.http.delete(`/me/messages/${id}`);
    } else {
      await this.http.post(`/me/messages/${id}/move`, { destinationId: 'deleteditems' });
    }
  }

  /** Restore a previously trashed message back to inbox (Graph). */
  async restoreFromTrash(id: string): Promise<void> {
    await this.http.post(`/me/messages/${id}/move`, { destinationId: 'inbox' });
  }

  async moveMessage(id: string, destinationFolderId: string): Promise<void> {
    await this.http.post(`/me/messages/${id}/move`, { destinationId: destinationFolderId });
  }

  async listMailFolders(): Promise<Folder[]> {
    const byId = new Map<string, Folder>();
    const systemNames = new Set([
      'Inbox',
      'Drafts',
      'Sent Items',
      'Deleted Items',
      'Junk Email',
      'Archive',
    ]);

    let url: string | undefined =
      '/me/mailFolders?$top=200&includeHiddenFolders=true&$select=id,displayName,totalItemCount,parentFolderId';

    while (url) {
      const resp: {
        data: {
          value: Array<{
            id: string;
            displayName: string;
            totalItemCount?: number;
            parentFolderId?: string;
          }>;
          '@odata.nextLink'?: string;
        };
      } = await this.http.get(url);
      for (const f of resp.data.value) {
        byId.set(f.id, {
          id: f.id,
          name: /^inbox$/i.test(f.displayName) ? 'Inbox' : f.displayName,
          count: f.totalItemCount,
          parentId: f.parentFolderId,
          isSystem: systemNames.has(f.displayName) || /^inbox$/i.test(f.displayName),
        });
      }
      const next = resp.data['@odata.nextLink'];
      url = next ? next.replace(GRAPH, '') : undefined;
    }

    // Well-known folders are sometimes missing from the root listing — fetch explicitly.
    const wellKnown: Array<{ key: string; label?: string; junk?: boolean }> = [
      { key: 'inbox', label: 'Inbox' },
      { key: 'junkemail', label: 'Junk Email', junk: true },
      { key: 'sentitems' },
      { key: 'drafts' },
      { key: 'deleteditems' },
      { key: 'archive' },
    ];

    for (const wk of wellKnown) {
      try {
        const resp = await this.http.get<{
          id: string;
          displayName: string;
          totalItemCount?: number;
          parentFolderId?: string;
        }>(`/me/mailFolders/${wk.key}?$select=id,displayName,totalItemCount,parentFolderId`);
        const f = resp.data;
        const name = wk.label ?? (/^inbox$/i.test(f.displayName) ? 'Inbox' : f.displayName);
        byId.set(f.id, {
          id: f.id,
          name,
          count: f.totalItemCount,
          parentId: f.parentFolderId,
          isSystem: true,
        });
      } catch {
        // Mailbox may not expose this folder — continue.
      }
    }

    // Walk every folder and fetch nested child folders (e.g. subfolders under Inbox).
    const visited = new Set<string>();
    const queue = [...byId.keys()];
    while (queue.length) {
      const folderId = queue.shift()!;
      if (visited.has(folderId)) continue;
      visited.add(folderId);

      let childUrl: string | undefined =
        `/me/mailFolders/${encodeURIComponent(folderId)}/childFolders?$top=200&includeHiddenFolders=true&$select=id,displayName,totalItemCount,parentFolderId,childFolderCount`;

      while (childUrl) {
        const childResp: {
          data: {
            value: Array<{
              id: string;
              displayName: string;
              totalItemCount?: number;
              parentFolderId?: string;
              childFolderCount?: number;
            }>;
            '@odata.nextLink'?: string;
          };
        } = await this.http.get(childUrl);

        for (const f of childResp.data.value) {
          if (!byId.has(f.id)) {
            byId.set(f.id, {
              id: f.id,
              name: f.displayName,
              count: f.totalItemCount,
              parentId: folderId,
              isSystem: false,
            });
            queue.push(f.id);
          }
        }
        const nextChild = childResp.data['@odata.nextLink'];
        childUrl = nextChild ? nextChild.replace(GRAPH, '') : undefined;
      }
    }

    return Array.from(byId.values());
  }

  /** Resolve a well-known folder id (e.g. inbox) without scanning the full tree. */
  async getWellKnownFolderId(wellKnownName: string): Promise<string | null> {
    try {
      const resp = await this.http.get<{ id: string }>(
        `/me/mailFolders/${encodeURIComponent(wellKnownName)}?$select=id`
      );
      return resp.data.id ?? null;
    } catch {
      return null;
    }
  }

  async createMailFolder(name: string): Promise<Folder> {
    const resp = await this.http.post<{ id: string; displayName: string }>(
      '/me/mailFolders',
      { displayName: name }
    );
    return { id: resp.data.id, name: resp.data.displayName };
  }

  async listRules(): Promise<MailRule[]> {
    const resp = await this.http.get<{
      value: Array<{
        id: string;
        displayName: string;
        sequence: number;
        isEnabled: boolean;
        conditions?: {
          fromAddresses?: Array<{ emailAddress: { address: string } }>;
          senderContains?: string[];
          subjectContains?: string[];
          bodyContains?: string[];
          hasAttachments?: boolean;
        };
        actions?: {
          moveToFolder?: string;
          delete?: boolean;
          markAsRead?: boolean;
          forwardTo?: Array<{ emailAddress: { address: string } }>;
          assignCategories?: string[];
        };
      }>;
    }>('/me/mailFolders/inbox/messageRules');

    return resp.data.value.map((r) => ({
      id: `graph-${r.id}`,
      providerRuleId: r.id,
      source: 'remote' as const,
      name: r.displayName,
      fromContains: r.conditions?.fromAddresses?.[0]?.emailAddress.address,
      senderContains: r.conditions?.senderContains?.[0],
      subjectContains: r.conditions?.subjectContains?.[0],
      bodyContains: r.conditions?.bodyContains?.[0],
      hasAttachment: r.conditions?.hasAttachments,
      moveToFolderId: r.actions?.moveToFolder,
      addLabel: r.actions?.assignCategories?.[0],
      delete: r.actions?.delete,
      markRead: r.actions?.markAsRead,
      forwardTo: r.actions?.forwardTo?.[0]?.emailAddress.address,
      enabled: r.isEnabled,
      createdAt: Date.now(),
    }));
  }

  async createRule(rule: MailRule): Promise<MailRule> {
    const conditions: Record<string, unknown> = {};
    if (rule.senderContains) {
      conditions.senderContains = [rule.senderContains];
    } else if (rule.fromContains) {
      conditions.fromAddresses = [
        { emailAddress: { address: rule.fromContains, name: rule.fromContains } },
      ];
    }
    if (rule.subjectContains) conditions.subjectContains = [rule.subjectContains];
    if (rule.bodyContains) conditions.bodyContains = [rule.bodyContains];
    if (rule.hasAttachment) conditions.hasAttachments = true;

    const actions: Record<string, unknown> = { stopProcessingRules: true };
    if (rule.delete) actions.delete = true;
    if (rule.markRead) actions.markAsRead = true;
    if (rule.moveToFolderId) actions.moveToFolder = rule.moveToFolderId;
    else if (rule.addLabel) actions.assignCategories = [rule.addLabel];
    if (rule.forwardTo) {
      actions.forwardTo = [{ emailAddress: { address: rule.forwardTo, name: rule.forwardTo } }];
    }

    const resp = await this.http.post<{ id: string }>(
      '/me/mailFolders/inbox/messageRules',
      {
        displayName: rule.name ?? `MailVault ${Date.now()}`,
        sequence: 1,
        isEnabled: rule.enabled,
        conditions,
        actions,
      }
    );
    return { ...rule, providerRuleId: resp.data.id, source: 'remote' };
  }

  async deleteRule(providerRuleId: string): Promise<void> {
    await this.http.delete(`/me/mailFolders/inbox/messageRules/${providerRuleId}`);
  }
}

interface GraphMessage {
  id: string;
  from?: { emailAddress: { address: string; name?: string } };
  subject?: string;
  bodyPreview?: string;
  receivedDateTime?: string;
  isRead?: boolean;
  internetMessageHeaders?: Array<{ name: string; value: string }>;
  parentFolderId?: string;
  hasAttachments?: boolean;
}

function estimateMessageSize(m: GraphMessage): number {
  const headersBytes = (m.internetMessageHeaders ?? []).reduce(
    (acc, h) => acc + h.name.length + (h.value?.length ?? 0) + 4,
    0
  );
  const subjectBytes = (m.subject ?? '').length;
  const previewBytes = (m.bodyPreview ?? '').length;
  const bodyBytes = previewBytes * 8;
  const attachFudge = m.hasAttachments ? 200_000 : 0;
  return headersBytes + subjectBytes + bodyBytes + attachFudge + 1024;
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

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}
