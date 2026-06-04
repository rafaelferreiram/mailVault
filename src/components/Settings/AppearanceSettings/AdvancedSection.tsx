import { useState } from 'react';
import { usePrefsStore } from '@/stores/prefsStore';
import { StyleCardGrid } from '@/components/Personalization/shared';
import type { StyleName } from '@shared/types';

export function AdvancedSection() {
  const style = usePrefsStore((s) => s.prefs.appearance.style);
  const setStyle = usePrefsStore((s) => s.setStyle);
  const customCss = usePrefsStore((s) => s.prefs.appearance.customCss);
  const setCustomCss = usePrefsStore((s) => s.setCustomCss);
  const resetThemeOnly = usePrefsStore((s) => s.resetThemeOnly);
  const resetAll = usePrefsStore((s) => s.resetAll);
  const [cssDraft, setCssDraft] = useState(customCss);

  return (
    <div>
      <header className="appearance-section-header">
        <div className="label-mono">Advanced</div>
        <p>Interface style presets, custom CSS injection, and reset options.</p>
      </header>
      <div className="mb-6 max-w-2xl">
        <div className="label-mono text-[10px] mb-2">Interface style</div>
        <StyleCardGrid selected={style} onSelect={(s) => setStyle(s as StyleName)} />
      </div>
      <div className="panel p-4 max-w-2xl space-y-2 mb-6">
        <div className="label-mono">Custom CSS</div>
        <textarea
          className="input font-mono text-[11px] min-h-[120px] w-full"
          value={cssDraft}
          onChange={(e) => setCssDraft(e.target.value)}
          onBlur={() => setCustomCss(cssDraft)}
          placeholder="/* Optional overrides */"
        />
        <button
          type="button"
          className="text-[11px] font-mono text-accent"
          onClick={() => setCustomCss(cssDraft)}
        >
          Apply CSS
        </button>
      </div>
      <div className="flex flex-wrap gap-4">
        <button
          type="button"
          onClick={resetThemeOnly}
          className="text-[11px] font-mono uppercase tracking-wider text-fg-muted hover:text-accent"
        >
          Reset theme defaults
        </button>
        <button
          type="button"
          onClick={resetAll}
          className="text-[11px] font-mono uppercase tracking-wider text-danger hover:underline"
        >
          Reset all appearance settings
        </button>
      </div>
    </div>
  );
}
