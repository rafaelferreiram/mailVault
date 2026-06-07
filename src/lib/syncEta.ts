import type { SyncStage, TimeRangeKey } from '@shared/types';

/** Baseline full-sync duration per window (good connection, typical mailbox). */
const BASE_ETA_MS: Record<TimeRangeKey, number> = {
  today: 30_000,
  '7d': 60_000,
  '30d': 120_000,
  '6mo': 300_000,
  '1y': 480_000,
  '2y': 900_000,
  '5y': 1_500_000,
  all: 2_100_000,
  custom: 120_000,
};

/** Typical message counts paired with each baseline ETA. */
const BASELINE_COUNTS: Record<TimeRangeKey, number> = {
  today: 25,
  '7d': 180,
  '30d': 900,
  '6mo': 3_500,
  '1y': 7_000,
  '2y': 14_000,
  '5y': 30_000,
  all: 50_000,
  custom: 900,
};

/** Reference probe round-trip on a typical home connection. */
const REF_PROBE_MS = 1_200;

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export type ProbeSample = { probeMs?: number; loading?: boolean };

export function averageProbeLatency(
  probes: Partial<Record<TimeRangeKey, ProbeSample>>
): number | null {
  const samples = Object.values(probes)
    .filter((p) => p && !p.loading && typeof p.probeMs === 'number' && p.probeMs > 0)
    .map((p) => p.probeMs as number);
  if (!samples.length) return null;
  return samples.reduce((a, b) => a + b, 0) / samples.length;
}

/** Maps average probe latency to a sync duration multiplier. */
export function connectionFactor(avgProbeMs: number | null | undefined): number {
  if (avgProbeMs == null || avgProbeMs <= 0) return 1;
  if (avgProbeMs < 400) return 0.85;
  if (avgProbeMs < 800) return 0.95;
  if (avgProbeMs < 1_800) return 1;
  if (avgProbeMs < 3_500) return 1.25;
  if (avgProbeMs < 6_000) return 1.55;
  return 1.9;
}

export function connectionLabel(avgProbeMs: number | null | undefined): string {
  const f = connectionFactor(avgProbeMs);
  if (f <= 0.9) return 'fast connection';
  if (f <= 1.05) return 'good connection';
  if (f <= 1.3) return 'moderate connection';
  return 'slow connection';
}

export function estimateSyncDurationMs(opts: {
  rangeKey: TimeRangeKey;
  emailCount?: number;
  avgProbeMs?: number | null;
}): number {
  const base = BASE_ETA_MS[opts.rangeKey] ?? BASE_ETA_MS['30d'];
  const baseline = BASELINE_COUNTS[opts.rangeKey] ?? BASELINE_COUNTS['30d'];
  const count = opts.emailCount ?? 0;
  const countFactor =
    count <= 0 ? 0.75 : clamp(Math.sqrt(count / baseline), 0.55, 3.5);
  return Math.round(base * countFactor * connectionFactor(opts.avgProbeMs));
}

export function estimateRemainingMs(opts: {
  estimatedTotalMs: number;
  startedAt: number;
  stage: SyncStage | null;
}): number {
  if (!opts.stage || opts.estimatedTotalMs <= 0) return 0;
  const overall =
    (opts.stage.index - 1 + clamp(opts.stage.progress ?? 0, 0, 1)) / opts.stage.total;
  const byProgress = opts.estimatedTotalMs * (1 - overall);
  const elapsed = Date.now() - opts.startedAt;
  const byPace = opts.estimatedTotalMs - elapsed;
  return Math.max(0, Math.round(byProgress * 0.65 + byPace * 0.35));
}

/** Human-readable ETA with leading tilde, e.g. ~30s or ~2 min. */
export function formatEtaEstimate(ms: number): string {
  if (!ms || ms < 0) return '—';
  const sec = Math.max(1, Math.round(ms / 1000));
  if (sec < 60) return `~${sec}s`;
  const min = Math.round(sec / 60);
  if (min < 60) return min === 1 ? '~1 min' : `~${min} min`;
  const h = Math.floor(min / 60);
  const rem = min % 60;
  return rem > 0 ? `~${h}h ${rem}m` : `~${h}h`;
}
