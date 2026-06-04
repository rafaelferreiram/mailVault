import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { Check } from 'lucide-react';
import { usePrefsStore } from '@/stores/prefsStore';
import { isValidHex } from '@/lib/themeEngine';
import {
  THEMES,
  STYLES,
  ACCENT_PRESETS,
  DENSITY_STOPS,
  MOTION_STOPS,
  ThemeSwatch,
  Segmented,
} from '@/components/Personalization/shared';
import type { DensityStop, MotionStop, StyleName, ThemeName } from '@shared/types';

export function SettingsAppearance() {
  const appearance = usePrefsStore((s) => s.prefs.appearance);
  const setTheme = usePrefsStore((s) => s.setTheme);
  const setStyle = usePrefsStore((s) => s.setStyle);
  const setAccent = usePrefsStore((s) => s.setAccent);
  const setDensity = usePrefsStore((s) => s.setDensity);
  const setMotion = usePrefsStore((s) => s.setMotion);
  const setReduceMotion = usePrefsStore((s) => s.setReduceMotion);
  const resetThemeOnly = usePrefsStore((s) => s.resetThemeOnly);

  const [draft, setDraft] = useState(appearance.accent);
  useEffect(() => setDraft(appearance.accent), [appearance.accent]);
  const draftValid = useMemo(() => isValidHex(draft), [draft]);

  return (
    <>
      <div className="panel p-4 space-y-3">
        <div className="label-mono">Color theme</div>
        <div className="grid grid-cols-3 gap-2">
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTheme(t.id)}
              className={clsx(
                'relative h-[72px] flex flex-col p-1.5 text-left border transition-colors',
                appearance.theme === t.id
                  ? 'border-accent bg-bg-hover'
                  : 'border-border-subtle hover:border-border-strong'
              )}
            >
              <ThemeSwatch theme={t.id} className="h-7 w-full" />
              <div className="mt-auto flex items-center gap-1 pt-1">
                <span className="text-[10px] font-mono text-fg truncate">{t.label}</span>
                {appearance.theme === t.id && <Check className="w-2.5 h-2.5 text-accent ml-auto" />}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="panel p-4 space-y-2">
        <div className="label-mono">Interface style</div>
        {STYLES.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setStyle(s.id as StyleName)}
            className={clsx(
              'w-full flex items-center gap-3 px-2 py-2 text-left border transition-colors',
              appearance.style === s.id
                ? 'border-accent/40 bg-accent/5'
                : 'border-transparent hover:bg-bg-hover'
            )}
          >
            <span
              className={clsx(
                'w-3 h-3 rounded-full border-2 shrink-0',
                appearance.style === s.id ? 'border-accent bg-accent' : 'border-fg-subtle'
              )}
            />
            <div>
              <div className="text-[12px] text-fg">{s.label}</div>
              <div className="text-[10px] text-fg-muted">{s.desc}</div>
            </div>
          </button>
        ))}
      </div>

      <div className="panel p-4 space-y-3">
        <div className="label-mono">Accent color</div>
        <div className="grid grid-cols-8 gap-1.5">
          {ACCENT_PRESETS.map((p) => (
            <button
              key={p.hex}
              type="button"
              onClick={() => setAccent(p.hex)}
              title={p.label}
              className={clsx(
                'relative h-6 w-full border',
                appearance.accent.toLowerCase() === p.hex.toLowerCase()
                  ? 'border-fg scale-105'
                  : 'border-border-subtle hover:border-border-strong'
              )}
              style={{ background: p.hex }}
            />
          ))}
        </div>
        <label className="flex items-center gap-2 text-[11px]">
          <span className="font-mono uppercase tracking-wider text-[10px] text-fg-subtle">Custom</span>
          <input
            type="text"
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              if (isValidHex(e.target.value)) setAccent(e.target.value);
            }}
            className={clsx('input h-7 font-mono text-[11px] flex-1', !draftValid && draft && 'border-danger/50')}
          />
        </label>
      </div>

      <div className="panel p-4 space-y-4">
        <div>
          <div className="label-mono mb-2">Density</div>
          <Segmented
            options={DENSITY_STOPS.map((d) => ({ id: d.id, label: d.label }))}
            value={appearance.density}
            onChange={(v) => setDensity(v as DensityStop)}
          />
        </div>
        <div>
          <div className="label-mono mb-2">Motion</div>
          <Segmented
            options={MOTION_STOPS}
            value={appearance.motion}
            onChange={(v) => setMotion(v as MotionStop)}
            disabled={appearance.reduceMotion}
          />
        </div>
        <label className="flex items-center gap-2 text-[12px] cursor-pointer">
          <input
            type="checkbox"
            checked={appearance.reduceMotion}
            onChange={(e) => setReduceMotion(e.target.checked)}
          />
          Reduce motion
        </label>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={resetThemeOnly}
          className="text-[11px] font-mono uppercase tracking-wider text-fg-muted hover:text-accent"
        >
          Reset theme defaults
        </button>
      </div>
    </>
  );
}
