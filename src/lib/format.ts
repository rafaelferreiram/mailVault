export function formatBytes(bytes: number, opts: { compact?: boolean } = {}): string {
  if (!bytes || bytes < 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  const decimals = opts.compact ? 0 : n >= 100 || i === 0 ? 0 : n >= 10 ? 1 : 2;
  return `${n.toFixed(decimals)} ${units[i]}`;
}

export function formatNumber(n: number, opts: { compact?: boolean } = {}): string {
  if (opts.compact && Math.abs(n) >= 1000) {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  }
  return new Intl.NumberFormat('en-US').format(n);
}

export function formatDateRange(oldest: number, newest: number): string {
  const fmt = (ms: number) =>
    new Date(ms).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  if (!oldest || !newest) return '—';
  if (Math.abs(newest - oldest) < 35 * 86400_000) return fmt(newest);
  return `${fmt(oldest)} → ${fmt(newest)}`;
}

export function relativeTime(ms: number): string {
  const diff = Date.now() - ms;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mo ago`;
  const y = Math.floor(mo / 12);
  return `${y}y ago`;
}

export function formatTimestampHHMMSS(ms: number): string {
  const d = new Date(ms);
  return [
    String(d.getHours()).padStart(2, '0'),
    String(d.getMinutes()).padStart(2, '0'),
    String(d.getSeconds()).padStart(2, '0'),
  ].join(':');
}

export function truncate(s: string, max: number): string {
  if (!s) return '';
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + '…';
}

export function initials(nameOrEmail: string): string {
  const s = (nameOrEmail || '').trim();
  if (!s) return '?';
  const parts = s.split(/[\s.@_-]+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '';
  const second = parts[1]?.[0] ?? '';
  return (first + second).toUpperCase() || s[0].toUpperCase();
}

export function formatDuration(ms: number): string {
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  const rem = sec % 60;
  return `${min}m ${String(rem).padStart(2, '0')}s`;
}
