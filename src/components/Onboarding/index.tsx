import { useEffect, useMemo, useRef } from 'react';
import { useOnboardingStore, ONBOARDING_TOTAL_STEPS } from '@/stores/onboardingStore';
import { useUIStore } from '@/stores/uiStore';
import { Spotlight, useTargetRect, useScrollTargetIntoView } from './Spotlight';
import { Tooltip } from './Tooltip';
import { buildSteps } from './steps';

/**
 * Root onboarding component. Mount once at the App root level.
 * Renders nothing unless the tour is active.
 */
export function OnboardingTour() {
  const open = useOnboardingStore((s) => s.open);
  const showResume = useOnboardingStore((s) => s.showResume);
  const showSkipConfirm = useOnboardingStore((s) => s.showSkipConfirm);
  const currentStep = useOnboardingStore((s) => s.currentStep);
  const next = useOnboardingStore((s) => s.next);
  const prev = useOnboardingStore((s) => s.prev);
  const requestSkip = useOnboardingStore((s) => s.requestSkip);
  const finish = useOnboardingStore((s) => s.finish);

  const setRoute = useUIStore((s) => s.setRoute);

  const steps = useMemo(
    () =>
      buildSteps({
        onFinishGoToAnalyze: () => {
          setRoute('analyze');
        },
      }),
    [setRoute]
  );

  // Apply route + drawer side-effects when stepping.
  const lastStepIdRef = useRef<number | null>(null);
  useEffect(() => {
    if (!open || showResume) return;
    if (lastStepIdRef.current === currentStep) return;
    lastStepIdRef.current = currentStep;
    const step = steps[currentStep - 1];
    if (!step) return;
    if (step.goToRoute) setRoute(step.goToRoute);
  }, [open, showResume, currentStep, steps, setRoute]);

  // Global keyboard shortcuts while tour is active.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (showResume || showSkipConfirm) return; // Modals consume their own keys.
      if (e.key === 'ArrowRight' || e.key === 'Enter') {
        e.preventDefault();
        if (currentStep === ONBOARDING_TOTAL_STEPS) finish();
        else next();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        prev();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        requestSkip();
      }
    };
    window.addEventListener('keydown', handler, { capture: true });
    return () => window.removeEventListener('keydown', handler, { capture: true } as any);
  }, [open, showResume, showSkipConfirm, currentStep, next, prev, requestSkip, finish]);

  if (!open) return null;
  if (showResume) return <ResumeModal />;

  const step = steps[currentStep - 1];
  if (!step) return null;

  return <TourFrame stepKey={step.id} step={step} />;
}

/**
 * Wrapper that owns the per-step rect tracking. Re-keys on step.id so
 * useTargetRect re-runs cleanly when changing steps.
 */
function TourFrame({ step, stepKey }: { step: ReturnType<typeof buildSteps>[number]; stepKey: number }) {
  const selector =
    step.type === 'spotlight' && step.target ? step.target : null;
  useScrollTargetIntoView(selector);
  const rect = useTargetRect(selector);

  return (
    <>
      <Spotlight rect={rect} hole={step.type === 'spotlight'} />
      <Tooltip step={step} rect={rect} />
      <SkipConfirmGate />
    </>
  );
}

// ─── Resume / Restart modal ────────────────────────────────────────

function ResumeModal() {
  const startFromBeginning = useOnboardingStore((s) => s.startFromBeginning);
  const resume = useOnboardingStore((s) => s.resume);
  const close = useOnboardingStore((s) => s.close);
  const currentStep = useOnboardingStore((s) => s.currentStep);

  return (
    <div
      role="dialog"
      aria-modal
      className="fixed inset-0 z-[1020] flex items-center justify-center p-6 bg-black/65 backdrop-blur-[2px] animate-fade-in"
      onClick={close}
    >
      <div
        className="bg-bg-elevated border border-border w-[460px] max-w-full p-7 animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 label-mono text-accent">
          <span aria-hidden>👋</span> Welcome back to the tour
        </div>
        <h2 className="mt-2 text-[20px] font-semibold tracking-tight">
          Pick up where you left off, or start fresh.
        </h2>
        <p className="mt-2 text-sm text-fg-muted">
          You were on step {currentStep} of {ONBOARDING_TOTAL_STEPS}. We'll
          remember your progress as you go.
        </p>
        <div className="mt-6 flex gap-2 justify-end">
          <button onClick={startFromBeginning} className="btn btn-secondary">
            Start from beginning
          </button>
          <button onClick={resume} className="btn btn-primary">
            Continue →
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Skip confirmation ─────────────────────────────────────────────

function SkipConfirmGate() {
  const showSkipConfirm = useOnboardingStore((s) => s.showSkipConfirm);
  const cancelSkip = useOnboardingStore((s) => s.cancelSkip);
  const confirmSkip = useOnboardingStore((s) => s.confirmSkip);
  if (!showSkipConfirm) return null;
  return (
    <div
      role="dialog"
      aria-modal
      className="fixed inset-0 z-[1030] flex items-center justify-center p-6 bg-black/70 backdrop-blur-[2px] animate-fade-in"
      onClick={cancelSkip}
    >
      <div
        className="bg-bg-elevated border border-border w-[420px] max-w-full p-6 animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="label-mono text-warn">Confirm</div>
        <h2 className="mt-1 text-[18px] font-semibold tracking-tight">
          Skip the tour?
        </h2>
        <p className="mt-2 text-sm text-fg-muted">
          You can restart it anytime from <span className="text-fg">Help → Show Me Around</span>{' '}
          or with <kbd className="kbd">⌘</kbd> <kbd className="kbd">⇧</kbd>{' '}
          <kbd className="kbd">?</kbd>.
        </p>
        <div className="mt-5 flex gap-2 justify-end">
          <button onClick={cancelSkip} className="btn btn-secondary">
            Keep going
          </button>
          <button onClick={confirmSkip} className="btn btn-danger">
            Skip tour
          </button>
        </div>
      </div>
    </div>
  );
}
