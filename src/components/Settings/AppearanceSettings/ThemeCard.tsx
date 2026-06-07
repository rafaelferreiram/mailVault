import clsx from 'clsx';
import { Check } from 'lucide-react';
import type { ThemeName } from '@shared/types';
import {
  ThemeMiniPreview,
  ThemePaletteStrip,
  themeLabel,
  themeModeLabel,
  THEME_PREVIEW,
} from './ThemeMiniPreview';

export function ThemeCard({
  theme,
  selected,
  onSelect,
  onHover,
}: {
  theme: ThemeName;
  selected: boolean;
  onSelect: () => void;
  onHover: (active: boolean) => void;
}) {
  const c = THEME_PREVIEW[theme];

  return (
    <button
      type="button"
      className={clsx('theme-card', selected && 'theme-card--selected')}
      onClick={onSelect}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      onFocus={() => onHover(true)}
      onBlur={() => onHover(false)}
      aria-pressed={selected}
      title={`${themeLabel(theme)} — ${themeModeLabel(theme)} theme`}
    >
      {selected && (
        <span className="check-badge z-10" aria-hidden>
          <Check className="w-3 h-3" strokeWidth={3} />
        </span>
      )}
      <div
        className="theme-card__preview"
        style={{
          background: `linear-gradient(135deg, ${c.content} 0%, ${c.sidebar} 100%)`,
        }}
      >
        <ThemeMiniPreview theme={theme} />
        <ThemePaletteStrip theme={theme} />
      </div>
      <div className="theme-card__label">
        <span className="theme-card__name">{themeLabel(theme)}</span>
        <span
          className="theme-card__mode"
          style={{ color: c.accent }}
        >
          {themeModeLabel(theme)}
        </span>
      </div>
    </button>
  );
}
