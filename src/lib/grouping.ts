import type { EmailMessage, SenderGroup } from '@shared/types';

export function groupBySender(messages: EmailMessage[]): SenderGroup[] {
  const map = new Map<string, SenderGroup>();
  for (const m of messages) {
    const key = m.fromEmail || '(unknown)';
    let g = map.get(key);
    if (!g) {
      g = {
        email: key,
        name: m.fromName || key,
        domain: (key.split('@')[1] ?? '').toLowerCase(),
        count: 0,
        totalBytes: 0,
        oldestAt: m.receivedAt,
        newestAt: m.receivedAt,
        unreadCount: 0,
        hasListUnsubscribe: false,
        isNewsletter: false,
        sampleSubjects: [],
        messageIds: [],
      };
      map.set(key, g);
    }
    g.count += 1;
    g.totalBytes += m.sizeBytes || 0;
    if (m.receivedAt < g.oldestAt) g.oldestAt = m.receivedAt;
    if (m.receivedAt > g.newestAt) g.newestAt = m.receivedAt;
    if (m.isUnread) g.unreadCount += 1;
    if (m.hasListUnsubscribe) g.hasListUnsubscribe = true;
    if (g.sampleSubjects.length < 5 && m.subject) g.sampleSubjects.push(m.subject);
    g.messageIds.push(m.id);
    if (m.fromName && !m.fromName.includes('@')) g.name = m.fromName;
  }
  // Mark newsletters: List-Unsubscribe + 5+ messages.
  for (const g of map.values()) {
    if (g.hasListUnsubscribe && g.count >= 5) g.isNewsletter = true;
  }
  return Array.from(map.values());
}

export type SortKey = 'count' | 'size' | 'recent';

export function sortGroups(groups: SenderGroup[], by: SortKey): SenderGroup[] {
  const cp = [...groups];
  switch (by) {
    case 'count':
      return cp.sort((a, b) => b.count - a.count);
    case 'size':
      return cp.sort((a, b) => b.totalBytes - a.totalBytes);
    case 'recent':
      return cp.sort((a, b) => b.newestAt - a.newestAt);
  }
}

export interface MonthlyVolume {
  monthKey: string;
  label: string;
  count: number;
}

export function monthlyVolume(messages: EmailMessage[]): MonthlyVolume[] {
  const map = new Map<string, { label: string; count: number }>();
  for (const m of messages) {
    const d = new Date(m.receivedAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    const cur = map.get(key) ?? { label, count: 0 };
    cur.count += 1;
    map.set(key, cur);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([monthKey, v]) => ({ monthKey, ...v }));
}

export function suggestRules(groups: SenderGroup[]): Array<{
  group: SenderGroup;
  reason: string;
  rule: {
    fromContains: string;
    archive?: boolean;
    delete?: boolean;
    markRead?: boolean;
    addLabel?: string;
  };
}> {
  const out: ReturnType<typeof suggestRules> = [];
  for (const g of groups) {
    if (g.count < 10) continue;
    const unreadRatio = g.unreadCount / g.count;
    if (g.hasListUnsubscribe && g.count >= 20 && unreadRatio > 0.5) {
      out.push({
        group: g,
        reason: `${g.count} mostly-unread newsletters with unsubscribe link`,
        rule: { fromContains: g.email, archive: true, markRead: true, addLabel: 'Newsletters' },
      });
    } else if (g.count >= 50 && unreadRatio > 0.75) {
      out.push({
        group: g,
        reason: `${g.count} messages, ${Math.round(unreadRatio * 100)}% unread — noisy sender`,
        rule: { fromContains: g.email, archive: true, markRead: true },
      });
    } else if (g.count >= 100 && g.totalBytes > 50 * 1024 * 1024) {
      out.push({
        group: g,
        reason: `${g.count} messages consuming significant space — auto-archive`,
        rule: { fromContains: g.email, archive: true },
      });
    }
  }
  return out.slice(0, 10);
}
