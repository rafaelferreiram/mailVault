import { useCallback, useRef, useState } from 'react';

const STORAGE_PREFIX = 'mailvault.panelWidth.';

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function readStoredWidth(key: string, defaultWidth: number, min: number, max: number) {
  try {
    const stored = localStorage.getItem(`${STORAGE_PREFIX}${key}`);
    if (stored) {
      const n = parseInt(stored, 10);
      if (!Number.isNaN(n)) return clamp(n, min, max);
    }
  } catch {
    // ignore quota / private mode
  }
  return defaultWidth;
}

export function useResizableWidth(
  key: string,
  defaultWidth: number,
  min: number,
  max: number
) {
  const storageKey = `${STORAGE_PREFIX}${key}`;
  const [width, setWidth] = useState(() => readStoredWidth(key, defaultWidth, min, max));
  const dragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  const onResizePointerDown = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      e.preventDefault();
      dragging.current = true;
      startX.current = e.clientX;
      startWidth.current = width;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [width]
  );

  const onResizePointerMove = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      if (!dragging.current) return;
      const delta = e.clientX - startX.current;
      setWidth(clamp(startWidth.current + delta, min, max));
    },
    [min, max]
  );

  const endResize = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      if (!dragging.current) return;
      dragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      const delta = e.clientX - startX.current;
      const next = clamp(startWidth.current + delta, min, max);
      setWidth(next);
      try {
        localStorage.setItem(storageKey, String(next));
      } catch {
        // ignore
      }
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    },
    [max, min, storageKey]
  );

  return {
    width,
    resizeHandleProps: {
      onPointerDown: onResizePointerDown,
      onPointerMove: onResizePointerMove,
      onPointerUp: endResize,
      onPointerCancel: endResize,
    },
  };
}
