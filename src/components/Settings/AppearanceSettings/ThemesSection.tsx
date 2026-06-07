import { useRef } from 'react';
import type { ThemeName } from '@shared/types';
import { usePrefsStore } from '@/stores/prefsStore';
import { ThemeEngine } from '@/lib/themeEngine';
import { ThemeCard } from './ThemeCard';
import { DARK_THEMES, LIGHT_THEMES } from './ThemeMiniPreview';
import { CustomThemeBuilder } from './CustomThemeBuilder';

export function ThemesSection() {
  const theme = usePrefsStore((s) => s.prefs.appearance.theme);
  const setTheme = usePrefsStore((s) => s.setTheme);
  const committedRef = useRef(theme);
  committedRef.current = theme;
  const revertTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const previewHover = (t: ThemeName | null) => {
    if (revertTimer.current) {
      clearTimeout(revertTimer.current);
      revertTimer.current = null;
    }
    if (t) {
      ThemeEngine.applyTheme(t);
      return;
    }
    revertTimer.current = setTimeout(() => {
      ThemeEngine.applyTheme(committedRef.current);
    }, 100);
  };

  const onSelect = (t: ThemeName) => {
    if (revertTimer.current) clearTimeout(revertTimer.current);
    setTheme(t);
    committedRef.current = t;
  };

  return (
    <div>
      <div className="label-mono text-[10px] mb-3">Dark themes</div>
      <div className="theme-card-grid mb-6">
        {DARK_THEMES.map((t) => (
          <ThemeCard
            key={t}
            theme={t}
            selected={theme === t}
            onSelect={() => onSelect(t)}
            onHover={(active) => previewHover(active ? t : null)}
          />
        ))}
      </div>
      <div className="label-mono text-[10px] mb-3">Light themes</div>
      <div className="theme-card-grid">
        {LIGHT_THEMES.map((t) => (
          <ThemeCard
            key={t}
            theme={t}
            selected={theme === t}
            onSelect={() => onSelect(t)}
            onHover={(active) => previewHover(active ? t : null)}
          />
        ))}
      </div>
      <CustomThemeBuilder />
    </div>
  );
}
