import { usePrefsStore } from '@/stores/prefsStore';
import { MOTION_STOPS, Segmented } from '@/components/Personalization/shared';
import { IosToggle } from './controls';
import type { MotionStop } from '@shared/types';

export function MotionSection() {
  const appearance = usePrefsStore((s) => s.prefs.appearance);
  const setMotion = usePrefsStore((s) => s.setMotion);
  const setReduceMotion = usePrefsStore((s) => s.setReduceMotion);

  return (
    <div className="panel p-4 max-w-md space-y-4">
      <Segmented
        options={MOTION_STOPS}
        value={appearance.motion}
        onChange={(v) => setMotion(v as MotionStop)}
        disabled={appearance.reduceMotion}
      />
      <IosToggle
        label="Reduce motion (accessibility override)"
        checked={appearance.reduceMotion}
        onChange={setReduceMotion}
      />
    </div>
  );
}
