import { create } from 'zustand';
import type { OnboardingState } from '@shared/types';

/**
 * Onboarding tour engine. The tour itself is a self-contained overlay that
 * lives on top of the entire app. Persistence is delegated to the main process
 * (electron-store), so progress survives restarts.
 *
 *   open + showResume → "Welcome back" modal (manual restart)
 *   open + !showResume → spotlight tour rendering at currentStep
 *   !open              → tour hidden
 */
interface TourState {
  /** Hydrated from disk. */
  completed: boolean;
  skipped: boolean;
  currentStep: number;
  lastSeenAt: number;
  completedAt: number | null;

  /** Transient UI state (not persisted). */
  open: boolean;
  /** When opened manually with prior progress, ask user to resume vs restart. */
  showResume: boolean;
  /** Confirmation prompt for Escape-to-skip. */
  showSkipConfirm: boolean;
  bootstrapped: boolean;

  bootstrap: () => Promise<void>;

  /** Auto-launch (called once, on login). No prompt — just start. */
  autoLaunchIfNeeded: () => void;
  /** Manual entry (menu / shortcut / settings). Shows resume modal if there's progress. */
  openManual: () => void;
  /** Force a fresh start at step 1. */
  startFromBeginning: () => void;
  /** Continue from the last-seen step. */
  resume: () => void;

  next: () => void;
  prev: () => void;
  goToStep: (n: number) => void;

  /** "Skip tour" link clicked. Asks for confirmation first. */
  requestSkip: () => void;
  /** Confirm dialog — yes, skip. */
  confirmSkip: () => void;
  cancelSkip: () => void;

  /** Final step → mark completed. */
  finish: () => void;

  /** Close overlay without changing skipped/completed (e.g. user reloaded). */
  close: () => void;
}

const TOTAL_STEPS = 11;

async function patch(p: Partial<OnboardingState>): Promise<void> {
  try {
    await window.mailvault.onboardingSet({ patch: p });
  } catch (err) {
    console.warn('[onboarding] persist failed', err);
  }
}

export const useOnboardingStore = create<TourState>((set, get) => ({
  completed: false,
  skipped: false,
  currentStep: 1,
  lastSeenAt: 0,
  completedAt: null,

  open: false,
  showResume: false,
  showSkipConfirm: false,
  bootstrapped: false,

  bootstrap: async () => {
    try {
      const s = await window.mailvault.onboardingGet();
      set({
        completed: !!s.completed,
        skipped: !!s.skipped,
        currentStep: clamp(s.currentStep ?? 1),
        lastSeenAt: s.lastSeenAt ?? 0,
        completedAt: s.completedAt ?? null,
        bootstrapped: true,
      });
    } catch (err) {
      console.warn('[onboarding] bootstrap failed', err);
      set({ bootstrapped: true });
    }
  },

  autoLaunchIfNeeded: () => {
    const { completed, skipped, bootstrapped } = get();
    if (!bootstrapped) return;
    if (completed || skipped) return;
    set({ open: true, showResume: false, showSkipConfirm: false, currentStep: 1 });
  },

  openManual: () => {
    const { currentStep, completed } = get();
    const hasProgress = !completed && currentStep > 1;
    set({
      open: true,
      showResume: hasProgress,
      showSkipConfirm: false,
      currentStep: hasProgress ? currentStep : 1,
    });
  },

  startFromBeginning: () => {
    set({ currentStep: 1, showResume: false, open: true, showSkipConfirm: false });
    void patch({ currentStep: 1, completed: false, skipped: false, completedAt: null });
  },

  resume: () => {
    set({ showResume: false });
  },

  next: () => {
    const cur = get().currentStep;
    if (cur >= TOTAL_STEPS) {
      get().finish();
      return;
    }
    const nxt = cur + 1;
    set({ currentStep: nxt });
    void patch({ currentStep: nxt });
  },

  prev: () => {
    const cur = get().currentStep;
    const nxt = Math.max(1, cur - 1);
    set({ currentStep: nxt });
    void patch({ currentStep: nxt });
  },

  goToStep: (n) => {
    const nxt = clamp(n);
    set({ currentStep: nxt });
    void patch({ currentStep: nxt });
  },

  requestSkip: () => set({ showSkipConfirm: true }),
  cancelSkip: () => set({ showSkipConfirm: false }),

  confirmSkip: () => {
    set({ open: false, skipped: true, showSkipConfirm: false });
    void patch({ skipped: true });
  },

  finish: () => {
    set({
      open: false,
      completed: true,
      completedAt: Date.now(),
      currentStep: TOTAL_STEPS,
    });
    void patch({
      completed: true,
      completedAt: Date.now(),
      currentStep: TOTAL_STEPS,
    });
  },

  close: () => set({ open: false, showSkipConfirm: false, showResume: false }),
}));

function clamp(n: number): number {
  if (!Number.isFinite(n)) return 1;
  return Math.min(TOTAL_STEPS, Math.max(1, Math.floor(n)));
}

export const ONBOARDING_TOTAL_STEPS = TOTAL_STEPS;
