import { describe, it, expect } from 'vitest';
import {
  averageProbeLatency,
  connectionFactor,
  estimateSyncDurationMs,
  formatEtaEstimate,
} from '@/lib/syncEta';

describe('syncEta', () => {
  it('uses baseline ETAs near user targets for typical counts', () => {
    expect(formatEtaEstimate(estimateSyncDurationMs({ rangeKey: 'today', emailCount: 25 }))).toBe(
      '~30s'
    );
    expect(formatEtaEstimate(estimateSyncDurationMs({ rangeKey: '7d', emailCount: 180 }))).toBe(
      '~1 min'
    );
    expect(formatEtaEstimate(estimateSyncDurationMs({ rangeKey: '30d', emailCount: 900 }))).toBe(
      '~2 min'
    );
  });

  it('slows ETA on high probe latency', () => {
    const fast = estimateSyncDurationMs({ rangeKey: '30d', emailCount: 900, avgProbeMs: 500 });
    const slow = estimateSyncDurationMs({ rangeKey: '30d', emailCount: 900, avgProbeMs: 4000 });
    expect(slow).toBeGreaterThan(fast);
  });

  it('averages probe latencies', () => {
    expect(
      averageProbeLatency({
        today: { probeMs: 1000 },
        '7d': { probeMs: 2000, loading: false },
        '30d': { loading: true },
      })
    ).toBe(1500);
  });

  it('scales ETA with email volume', () => {
    const small = estimateSyncDurationMs({ rangeKey: '30d', emailCount: 100 });
    const large = estimateSyncDurationMs({ rangeKey: '30d', emailCount: 9000 });
    expect(large).toBeGreaterThan(small);
  });

  it('formats connection factor tiers', () => {
    expect(connectionFactor(300)).toBeLessThan(1);
    expect(connectionFactor(5000)).toBeGreaterThan(1.2);
  });
});
