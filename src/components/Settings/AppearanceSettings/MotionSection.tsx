import { usePrefsStore } from '@/stores/prefsStore';
import { MOTION_STOPS, Segmented } from '@/components/Personalization/shared';
import type { MotionStop } from '@shared/types';

export function MotionSection() {
  const appearance = usePrefsStore((s) => s.prefs.appearance);
  const setMotion = usePrefsStore((s) => s.setMotion);
  const setReduceMotion = usePrefsStore((s) => s.setReduceMotion);

  return (
    <div>
      <header className="appearance-section-header">
        <div className="label-mono">Motion</div>
        <p>Animation speed for transitions, drawers, and micro-interactions.</p>
      </header>
      <div className="panel p-4 max-w-md space-y-4">
        <Segmented
          options={MOTION_STOPS}
          value={appearance.motion}
          onChange={(v) => setMotion(v as MotionStop)}
          disabled={appearance.reduceMotion}
        />
        <label className="flex items-center gap-2 text-[12px] cursor-pointer">
          <input
            type="checkbox"
            checked={appearance.reduceMotion}
            onChange={(e) => setReduceMotion(e.target.checked)}
          />
          Reduce motion (system override)
        </label>
      </div>
    </div>
  );
}
