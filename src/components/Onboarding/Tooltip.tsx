import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import clsx from 'clsx';
import { useOnboardingStore, ONBOARDING_TOTAL_STEPS } from '@/stores/onboardingStore';
import type { TargetRect } from './Spotlight';
import type { OnboardingStep } from './steps';

const TOOLTIP_W = 300;
const TOOLTIP_GAP = 14;
const SCREEN_PAD = 16;

interface Props {
  step: OnboardingStep;
  rect: TargetRect | null;
}

export function Tooltip({ step, rect }: Props) {
  const next = useOnboardingStore((s) => s.next);
  const prev = useOnboardingStore((s) => s.prev);
  const requestSkip = useOnboardingStore((s) => s.requestSkip);
  const finish = useOnboardingStore((s) => s.finish);
  const cur = useOnboardingStore((s) => s.currentStep);

  const isLast = cur === ONBOARDING_TOTAL_STEPS;
  const isFirst = cur === 1;

  const onPrimary = () => {
    if (step.primaryAction) step.primaryAction();
    if (isLast) finish();
    else next();
  };

  // For modal-style steps: center on screen.
  if (step.type === 'modal') {
    return (
      <ModalCard
        step={step}
        onPrev={prev}
        onPrimary={onPrimary}
        onSkip={requestSkip}
        isFirst={isFirst}
        isLast={isLast}
      />
    );
  }

  // Spotlight tooltip — measure its own height so we can flip if it overflows.
  return (
    <PositionedCard
      step={step}
      rect={rect}
      onPrev={prev}
      onPrimary={onPrimary}
      onSkip={requestSkip}
      isFirst={isFirst}
      isLast={isLast}
    />
  );
}

// ─── Centered Modal (steps 1 + 11) ──────────────────────────────────

function ModalCard({
  step,
  onPrev,
  onPrimary,
  onSkip,
  isFirst,
  isLast,
}: {
  step: OnboardingStep;
  onPrev: () => void;
  onPrimary: () => void;
  onSkip: () => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  const cur = useOnboardingStore((s) => s.currentStep);
  return (
    <div
      role="dialog"
      aria-labelledby="ob-headline"
      className="fixed inset-0 z-[1010] flex items-center justify-center pointer-events-none p-6"
    >
      <div
        className={clsx(
          'pointer-events-auto bg-bg-elevated border border-border w-[520px] max-w-full',
          'shadow-[0_20px_80px_rgba(0,0,0,0.5)]',
          'animate-fade-in'
        )}
      >
        {/* Header strip: skip + step counter */}
        <Header onSkip={onSkip} />

        <div className="p-7">
          {step.kicker && (
            <div className="label-mono text-accent mb-3 flex items-center gap-2">
              <Sparkles className="w-3 h-3" />
              {step.kicker}
            </div>
          )}
          <h1 id="ob-headline" className="text-[24px] leading-[30px] font-semibold tracking-tight">
            {step.headline}
          </h1>
          <p className="mt-3 text-sm text-fg-muted leading-relaxed">{step.subtext}</p>

          {step.callout && <Callout {...step.callout} className="mt-4" />}

          {step.visual && (
            <div className="mt-5 panel-inset p-4 animate-fade-in">{step.visual}</div>
          )}
        </div>

        <Footer
          onPrev={onPrev}
          onPrimary={onPrimary}
          isFirst={isFirst}
          primaryLabel={step.primaryLabel ?? (isLast ? 'Start Analyzing →' : "Let's go →")}
        />
        <ProgressDots current={cur} />
      </div>
    </div>
  );
}

// ─── Spotlight tooltip ──────────────────────────────────────────────

function PositionedCard({
  step,
  rect,
  onPrev,
  onPrimary,
  onSkip,
  isFirst,
  isLast,
}: {
  step: OnboardingStep;
  rect: TargetRect | null;
  onPrev: () => void;
  onPrimary: () => void;
  onSkip: () => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const cur = useOnboardingStore((s) => s.currentStep);

  useEffect(() => {
    if (!el) return;
    const r = el.getBoundingClientRect();
    setSize({ w: r.width, h: r.height });
  }, [el, step.id]);

  const pos = computePosition(rect, size, step.preferredPlacement);

  return (
    <div
      ref={setEl}
      role="dialog"
      aria-labelledby="ob-headline"
      className={clsx(
        'fixed z-[1010] pointer-events-auto bg-bg-elevated border border-border',
        'shadow-[0_12px_48px_rgba(0,0,0,0.55)]',
        'animate-fade-in'
      )}
      style={{
        width: TOOLTIP_W,
        maxWidth: `calc(100vw - ${SCREEN_PAD * 2}px)`,
        top: pos.top,
        left: pos.left,
        // Slide-toward-target animation:
        transform: `translate(${pos.fromX}px, ${pos.fromY}px)`,
        animation: 'fadeIn 140ms ease-out forwards, ob-slide 160ms ease-out forwards',
      }}
    >
      {/* arrow */}
      {pos.arrowSide && rect && <Arrow side={pos.arrowSide} />}
      <Header onSkip={onSkip} />
      <div className="p-5">
        {step.kicker && (
          <div className="label-mono text-accent mb-2 flex items-center gap-1.5">
            <Sparkles className="w-3 h-3" />
            {step.kicker}
          </div>
        )}
        <h2
          id="ob-headline"
          className="text-[15px] leading-[22px] font-semibold tracking-tight"
        >
          {step.headline}
        </h2>
        <p className="mt-2 text-[12.5px] text-fg-muted leading-relaxed">{step.subtext}</p>

        {step.callout && <Callout {...step.callout} className="mt-3" />}
        {step.visual && (
          <div className="mt-3 panel-inset p-3 animate-fade-in">{step.visual}</div>
        )}
      </div>
      <Footer
        onPrev={onPrev}
        onPrimary={onPrimary}
        isFirst={isFirst}
        primaryLabel={step.primaryLabel ?? (isLast ? 'Done →' : 'Next →')}
      />
      <ProgressDots current={cur} />

      <style>{`@keyframes ob-slide { from { transform: translate(${pos.fromX}px, ${pos.fromY}px); } to { transform: translate(0, 0); } }`}</style>
    </div>
  );
}

function computePosition(
  rect: TargetRect | null,
  size: { w: number; h: number } | null,
  preferred: 'auto' | 'top' | 'bottom' | 'left' | 'right' | 'center' = 'auto'
): {
  top: number;
  left: number;
  fromX: number;
  fromY: number;
  arrowSide: 'top' | 'bottom' | 'left' | 'right' | null;
} {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const w = size?.w ?? TOOLTIP_W;
  const h = size?.h ?? 280;

  // No rect → center on screen (e.g. target not found).
  if (!rect || preferred === 'center') {
    return {
      top: Math.max(SCREEN_PAD, vh / 2 - h / 2),
      left: Math.max(SCREEN_PAD, vw / 2 - w / 2),
      fromX: 0,
      fromY: 8,
      arrowSide: null,
    };
  }

  // Decide side. Auto = best fit.
  const side =
    preferred === 'auto' ? autoSide(rect, w, h, vw, vh) : preferred;

  let top = 0;
  let left = 0;
  let fromX = 0;
  let fromY = 0;
  let arrowSide: 'top' | 'bottom' | 'left' | 'right' = 'top';

  switch (side) {
    case 'bottom': {
      top = rect.top + rect.height + TOOLTIP_GAP;
      left = rect.left + rect.width / 2 - w / 2;
      fromY = -8;
      arrowSide = 'top';
      break;
    }
    case 'top': {
      top = rect.top - h - TOOLTIP_GAP;
      left = rect.left + rect.width / 2 - w / 2;
      fromY = 8;
      arrowSide = 'bottom';
      break;
    }
    case 'right': {
      top = rect.top + rect.height / 2 - h / 2;
      left = rect.left + rect.width + TOOLTIP_GAP;
      fromX = -8;
      arrowSide = 'left';
      break;
    }
    case 'left': {
      top = rect.top + rect.height / 2 - h / 2;
      left = rect.left - w - TOOLTIP_GAP;
      fromX = 8;
      arrowSide = 'right';
      break;
    }
  }

  // Clamp to viewport with 16px margin.
  if (left + w > vw - SCREEN_PAD) left = vw - SCREEN_PAD - w;
  if (left < SCREEN_PAD) left = SCREEN_PAD;
  if (top + h > vh - SCREEN_PAD) top = vh - SCREEN_PAD - h;
  if (top < SCREEN_PAD) top = SCREEN_PAD;

  return { top, left, fromX, fromY, arrowSide };
}

function autoSide(
  rect: TargetRect,
  w: number,
  h: number,
  vw: number,
  vh: number
): 'top' | 'bottom' | 'left' | 'right' {
  const spaceBelow = vh - (rect.top + rect.height);
  const spaceAbove = rect.top;
  const spaceRight = vw - (rect.left + rect.width);
  const spaceLeft = rect.left;

  // Prefer the side with the most room and that fits the tooltip.
  const fits = (s: number, dim: number) => s >= dim + TOOLTIP_GAP + SCREEN_PAD;
  if (fits(spaceBelow, h)) return 'bottom';
  if (fits(spaceAbove, h)) return 'top';
  if (fits(spaceRight, w)) return 'right';
  if (fits(spaceLeft, w)) return 'left';

  // Nothing fits — return whichever has most room.
  const max = Math.max(spaceBelow, spaceAbove, spaceRight, spaceLeft);
  if (max === spaceBelow) return 'bottom';
  if (max === spaceAbove) return 'top';
  if (max === spaceRight) return 'right';
  return 'left';
}

function Arrow({ side }: { side: 'top' | 'bottom' | 'left' | 'right' }) {
  // 8px triangle, color matches accent
  const base =
    'absolute w-2 h-2 bg-bg-elevated border-border border rotate-45';
  let style: React.CSSProperties = {};
  switch (side) {
    case 'top':
      style = { top: -5, left: 'calc(50% - 4px)', borderRight: 'none', borderBottom: 'none' };
      break;
    case 'bottom':
      style = { bottom: -5, left: 'calc(50% - 4px)', borderTop: 'none', borderLeft: 'none' };
      break;
    case 'left':
      style = { left: -5, top: 'calc(50% - 4px)', borderRight: 'none', borderTop: 'none' };
      break;
    case 'right':
      style = { right: -5, top: 'calc(50% - 4px)', borderLeft: 'none', borderBottom: 'none' };
      break;
  }
  return <div className={base} style={style} />;
}

function Header({ onSkip }: { onSkip: () => void }) {
  const cur = useOnboardingStore((s) => s.currentStep);
  return (
    <div className="px-5 py-2.5 border-b border-border-subtle flex items-center justify-between bg-bg-inset/40">
      <div className="label-mono">
        Tour · Step {cur} of {ONBOARDING_TOTAL_STEPS}
      </div>
      <button
        onClick={onSkip}
        className="text-[10px] font-mono uppercase tracking-widest text-fg-subtle hover:text-fg"
      >
        Skip tour
      </button>
    </div>
  );
}

function Footer({
  onPrev,
  onPrimary,
  isFirst,
  primaryLabel,
}: {
  onPrev: () => void;
  onPrimary: () => void;
  isFirst: boolean;
  primaryLabel: string;
}) {
  return (
    <div className="px-5 py-3 border-t border-border-subtle flex items-center justify-between gap-2 bg-bg-inset/40">
      <button
        onClick={onPrev}
        disabled={isFirst}
        className={clsx(
          'btn btn-ghost gap-1 px-2',
          isFirst && 'opacity-30 cursor-not-allowed'
        )}
      >
        <ChevronLeft className="w-3 h-3" />
        Back
      </button>
      <button onClick={onPrimary} className="btn btn-primary gap-1">
        {primaryLabel}
      </button>
    </div>
  );
}

function ProgressDots({ current }: { current: number }) {
  return (
    <div className="px-5 pb-3 -mt-1 flex items-center gap-1">
      {Array.from({ length: ONBOARDING_TOTAL_STEPS }).map((_, i) => {
        const filled = i + 1 <= current;
        const active = i + 1 === current;
        return (
          <div
            key={i}
            className={clsx(
              'h-[3px] flex-1 transition-colors',
              active
                ? 'bg-accent'
                : filled
                ? 'bg-accent/40'
                : 'bg-border'
            )}
          />
        );
      })}
    </div>
  );
}

// ─── Callout pill (tip / safety / trust) ────────────────────────────

interface CalloutProps {
  type: 'tip' | 'safety' | 'trust' | 'note';
  text: string;
  className?: string;
}

function Callout({ type, text, className }: CalloutProps) {
  const palette =
    type === 'tip'
      ? 'border-info/30 text-info bg-info/5'
      : type === 'safety'
      ? 'border-ok/30 text-ok bg-ok/5'
      : type === 'trust'
      ? 'border-accent/30 text-accent bg-accent/5'
      : 'border-border-subtle text-fg-muted bg-bg-inset';
  const icon = type === 'tip' ? '💡' : type === 'safety' ? '🗑️' : type === 'trust' ? '🔒' : 'ℹ︎';
  return (
    <div className={clsx('border px-3 py-2 text-[12px] flex gap-2', palette, className)}>
      <span aria-hidden className="shrink-0">
        {icon}
      </span>
      <span>{text}</span>
    </div>
  );
}

// Re-exported callout for use in step visuals.
export { Callout };

export { ChevronRight as _NextIcon };
