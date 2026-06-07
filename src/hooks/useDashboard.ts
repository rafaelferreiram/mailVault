import { useCallback, useEffect, useRef, useState } from 'react';
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
  const hasLoaded = useRef(false);

  const refresh = useCallback(
    async (background = false) => {
      if (!background) setLoading(true);
      setError(null);
      try {
        const snap = await window.mailvault.getDashboard(scope);
        setData(snap);
        hasLoaded.current = true;
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [scope]
  );

  useEffect(() => {
    hasLoaded.current = false;
    void refresh(false);
  }, [refresh]);

  useEffect(() => {
    const unsub = window.mailvault.onSyncProgress?.((evt) => {
      if (evt.done && !evt.error) void refresh(true);
    });
    return () => {
      unsub?.();
    };
  }, [refresh]);

  return { data, loading: loading && !hasLoaded.current, error, refresh: () => refresh(true) };
}
