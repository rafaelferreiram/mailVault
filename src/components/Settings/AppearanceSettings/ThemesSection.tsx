import { useRef } from 'react';
import { usePrefsStore } from '@/stores/prefsStore';
import type { ThemeName } from '@shared/types';
import { ThemeEngine } from '@/lib/themeEngine';
import { ThemeCard } from './ThemeCard';
import { DARK_THEMES, LIGHT_THEMES } from './ThemeMiniPreview';
import { CustomThemeBuilder } from './CustomThemeBuilder';

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <header className="appearance-section-header">
      <div className="label-mono">{title}</div>
      <p>{subtitle}</p>
    </header>
  );
}

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
      <SectionHeader
        title="Themes"
        subtitle="Hover to preview on the live app. Click to keep your choice."
      />
      <div className="label-mono text-[10px] mb-3 mt-6">Dark themes</div>
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
