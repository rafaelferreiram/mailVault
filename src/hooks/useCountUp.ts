import { useEffect, useRef, useState } from 'react';

export function useCountUp(
  target: number,
  opts?: { duration?: number; enabled?: boolean; decimals?: number }
) {
  const duration = opts?.duration ?? 400;
  const enabled = opts?.enabled ?? true;
  const decimals = opts?.decimals ?? 0;
  const [value, setValue] = useState(enabled ? 0 : target);
  const ran = useRef(false);

  useEffect(() => {
    if (!enabled) {
      setValue(target);
      return;
    }
    if (ran.current) {
      setValue(target);
      return;
    }
    ran.current = true;
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) ** 3;
      const v = target * eased;
      setValue(decimals > 0 ? Math.round(v * 10 ** decimals) / 10 ** decimals : Math.round(v));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration, enabled, decimals]);

  return value;
}
