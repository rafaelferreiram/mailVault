import type { TimeRange, TimeRangeKey } from '@shared/types';

const DAY = 86_400_000;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

export interface RangeOption {
  key: TimeRangeKey;
  label: string;
  short: string;
  description: string;
}

export const RANGES: RangeOption[] = [
  { key: 'today', label: 'Today', short: '24H', description: 'Last 24 hours' },
  { key: '7d', label: '7 days', short: '7D', description: 'Past week' },
  { key: '30d', label: '30 days', short: '30D', description: 'Past month' },
  { key: '6mo', label: '6 months', short: '6M', description: 'Past 6 months' },
  { key: '1y', label: '1 year', short: '1Y', description: 'Past year' },
  { key: '2y', label: '2 years', short: '2Y', description: 'Past 2 years' },
  { key: '5y', label: '5 years', short: '5Y', description: 'Past 5 years' },
  { key: 'all', label: 'All time', short: 'ALL', description: 'Entire mailbox' },
];

export function rangeFromKey(key: TimeRangeKey): TimeRange {
  const now = Date.now();
  switch (key) {
    case 'today':
      return { key, startMs: now - DAY, endMs: now };
    case '7d':
      return { key, startMs: now - 7 * DAY, endMs: now };
    case '30d':
      return { key, startMs: now - 30 * DAY, endMs: now };
    case '6mo':
      return { key, startMs: now - 6 * MONTH, endMs: now };
    case '1y':
      return { key, startMs: now - YEAR, endMs: now };
    case '2y':
      return { key, startMs: now - 2 * YEAR, endMs: now };
    case '5y':
      return { key, startMs: now - 5 * YEAR, endMs: now };
    case 'all':
      return { key };
    case 'custom':
      return { key };
  }
}

/** Average bytes per message used to estimate storage from a count probe. */
export const AVG_MSG_BYTES = 60 * 1024; // 60 KB heuristic — consistent with most mailboxes
