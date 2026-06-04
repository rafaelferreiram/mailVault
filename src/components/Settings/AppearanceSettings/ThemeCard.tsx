import clsx from 'clsx';
import { Check } from 'lucide-react';
import type { ThemeName } from '@shared/types';
import { ThemeMiniPreview, themeLabel, themeModeLabel } from './ThemeMiniPreview';

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
    >
      {selected && (
        <span className="check-badge z-10" aria-hidden>
          <Check className="w-3 h-3" strokeWidth={3} />
        </span>
      )}
      <div className="theme-card__preview">
        <ThemeMiniPreview theme={theme} />
      </div>
      <div className="theme-card__label">
        <span className="font-medium text-fg">{themeLabel(theme)}</span>
        <span className="text-fg-subtle">{themeModeLabel(theme)}</span>
      </div>
    </button>
  );
}
