import { usePrefsStore } from '@/stores/prefsStore';
import { DENSITY_STOPS, Segmented } from '@/components/Personalization/shared';
import type { DensityStop } from '@shared/types';

export function DensitySection() {
  const density = usePrefsStore((s) => s.prefs.appearance.density);
  const setDensity = usePrefsStore((s) => s.setDensity);

  return (
    <div className="panel p-4 max-w-md">
      <Segmented
        options={DENSITY_STOPS.map((d) => ({ id: d.id, label: d.label }))}
        value={density}
        onChange={(v) => setDensity(v as DensityStop)}
      />
    </div>
  );
}
