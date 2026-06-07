import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { usePrefsStore } from '@/stores/prefsStore';
import { isValidHex } from '@/lib/themeEngine';
import { ACCENT_PRESETS } from '@/components/Personalization/shared';

export function AccentSection() {
  const accent = usePrefsStore((s) => s.prefs.appearance.accent);
  const setAccent = usePrefsStore((s) => s.setAccent);
  const [draft, setDraft] = useState(accent);
  useEffect(() => setDraft(accent), [accent]);
  const valid = useMemo(() => isValidHex(draft), [draft]);

  return (
    <div className="panel p-4 max-w-lg space-y-3">
      <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
        {ACCENT_PRESETS.map((p) => (
          <button
            key={p.hex}
            type="button"
            onClick={() => setAccent(p.hex)}
            title={p.label}
            className={clsx(
              'h-7 w-full border',
              accent.toLowerCase() === p.hex.toLowerCase()
                ? 'border-fg ring-1 ring-accent'
                : 'border-border-subtle hover:border-border-strong'
            )}
            style={{ background: p.hex }}
          />
        ))}
      </div>
      <label className="flex flex-wrap items-center gap-2 text-[11px]">
        <span className="font-mono uppercase tracking-wider text-[10px] text-fg-subtle">Custom</span>
        <input
          type="color"
          value={valid ? draft : accent}
          onChange={(e) => {
            setDraft(e.target.value);
            setAccent(e.target.value);
          }}
          className="w-8 h-7 border border-border-subtle"
        />
        <input
          type="text"
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            if (isValidHex(e.target.value)) setAccent(e.target.value);
          }}
          className={clsx('input h-7 font-mono text-[11px] flex-1 min-w-[120px]', !valid && draft && 'border-danger/50')}
        />
      </label>
    </div>
  );
}
