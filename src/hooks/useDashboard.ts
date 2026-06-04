import { useCallback, useEffect, useState } from 'react';
import type { DashboardSnapshot } from '@shared/types';

let sessionAnimated = false;

export function markDashboardAnimated() {
  sessionAnimated = true;
}

export function shouldAnimateDashboard(): boolean {
  return !sessionAnimated;
}

export function useDashboard(scope: string | 'all') {
  const [data, setData] = useState<DashboardSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const snap = await window.mailvault.getDashboard(scope);
      setData(snap);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const unsub = window.mailvault.onSyncProgress?.((evt) => {
      if (evt.done) void refresh();
    });
    const onLive = window.mailvault.onLivePollStatus?.(() => {
      void refresh();
    });
    return () => {
      unsub?.();
      onLive?.();
    };
  }, [refresh]);

  return { data, loading, error, refresh };
}
