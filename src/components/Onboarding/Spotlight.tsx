import { useLayoutEffect, useState, useEffect } from 'react';

/**
 * Cuts a "hole" out of a dark backdrop by rendering four rectangles around
 * the target's bounding rect. The target's pixels remain visible because
 * nothing covers it. A halo is drawn on top to make the target glow.
 */
export interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface Props {
  rect: TargetRect | null;
  /** Padding around target (px). */
  pad?: number;
  /** When false, renders just a flat backdrop (no hole). */
  hole?: boolean;
}

export function Spotlight({ rect, pad = 6, hole = true }: Props) {
  if (!hole || !rect) {
    return (
      <div className="fixed inset-0 z-[1000] bg-black/60 backdrop-blur-[2px] animate-fade-in pointer-events-auto" />
    );
  }

  const top = Math.max(0, rect.top - pad);
  const left = Math.max(0, rect.left - pad);
  const width = rect.width + pad * 2;
  const height = rect.height + pad * 2;

  // 4-rect backdrop punching a hole. Each rect blocks pointer events too.
  const overlayClass =
    'fixed bg-black/55 backdrop-blur-[2px] pointer-events-auto z-[1000]';

  return (
    <>
      <div
        className={overlayClass}
        style={{ top: 0, left: 0, right: 0, height: top }}
      />
      <div
        className={overlayClass}
        style={{ top, left: 0, width: left, height }}
      />
      <div
        className={overlayClass}
        style={{ top, left: left + width, right: 0, height }}
      />
      <div
        className={overlayClass}
        style={{ top: top + height, left: 0, right: 0, bottom: 0 }}
      />
      {/* Halo ring around the target — purely decorative, doesn't capture clicks */}
      <div
        className="fixed pointer-events-none z-[1001] animate-fade-in"
        style={{
          top,
          left,
          width,
          height,
          boxShadow:
            '0 0 0 2px rgba(0, 212, 255, 0.95), 0 0 0 6px rgba(0, 212, 255, 0.16), 0 0 28px rgba(0, 212, 255, 0.35)',
        }}
      />
    </>
  );
}

/**
 * Tracks a DOM element's bounding rect, updating on scroll/resize and on a
 * polling tick (cheap insurance against animations and routing transitions).
 */
export function useTargetRect(selector: string | null): TargetRect | null {
  const [rect, setRect] = useState<TargetRect | null>(null);

  useLayoutEffect(() => {
    if (!selector) {
      setRect(null);
      return;
    }
    let cancelled = false;
    let timer: number | null = null;

    function recompute() {
      if (cancelled) return;
      const el = document.querySelector(selector!) as HTMLElement | null;
      if (!el) {
        setRect((prev) => (prev === null ? prev : null));
        return;
      }
      const r = el.getBoundingClientRect();
      const next: TargetRect = {
        top: r.top,
        left: r.left,
        width: r.width,
        height: r.height,
      };
      setRect((prev) => {
        if (
          prev &&
          prev.top === next.top &&
          prev.left === next.left &&
          prev.width === next.width &&
          prev.height === next.height
        ) {
          return prev;
        }
        return next;
      });
    }

    recompute();
    const onScroll = () => recompute();
    window.addEventListener('resize', onScroll);
    window.addEventListener('scroll', onScroll, true);
    // Poll every 200ms for the first 2 seconds to catch route transitions.
    timer = window.setInterval(recompute, 200);

    return () => {
      cancelled = true;
      if (timer) window.clearInterval(timer);
      window.removeEventListener('resize', onScroll);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [selector]);

  return rect;
}

/**
 * Smooth-scrolls the target into view (centered). Returns when reasonably
 * stable. Cheap and best-effort.
 */
export function useScrollTargetIntoView(selector: string | null) {
  useEffect(() => {
    if (!selector) return;
    const el = document.querySelector(selector) as HTMLElement | null;
    if (!el) return;
    try {
      el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    } catch {
      el.scrollIntoView();
    }
  }, [selector]);
}
