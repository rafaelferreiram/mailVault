import { useCallback, useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { ChevronDown } from 'lucide-react';
import type { CustomThemeTokens } from '@shared/types';
import { usePrefsStore } from '@/stores/prefsStore';
import { isValidHex } from '@/lib/themeEngine';

const TOKEN_ROWS: Array<{ key: keyof CustomThemeTokens; label: string; default: string }> = [
  { key: 'bgBase', label: '--bg-base', default: '#080b0f' },
  { key: 'bgSurface', label: '--bg-surface', default: '#0f1318' },
  { key: 'bgElevated', label: '--bg-elevated', default: '#161c24' },
  { key: 'border', label: '--border', default: '#1e2a38' },
  { key: 'textPrimary', label: '--text-primary', default: '#e2eaf4' },
  { key: 'textMuted', label: '--text-muted', default: '#4d6070' },
  { key: 'accent', label: '--accent', default: '#00d4ff' },
];

const DEFAULT_CUSTOM: CustomThemeTokens = {
  bgBase: '#080b0f',
  bgSurface: '#0f1318',
  bgElevated: '#161c24',
  border: '#1e2a38',
  textPrimary: '#e2eaf4',
  textMuted: '#4d6070',
  accent: '#00d4ff',
};

export function CustomThemeBuilder() {
  const [open, setOpen] = useState(false);
  const customTheme = usePrefsStore((s) => s.prefs.appearance.customTheme);
  const setCustomTheme = usePrefsStore((s) => s.setCustomTheme);
  const [draft, setDraft] = useState<CustomThemeTokens>(customTheme ?? DEFAULT_CUSTOM);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (customTheme) setDraft(customTheme);
  }, [customTheme]);

  const pushDraft = useCallback(
    (next: CustomThemeTokens) => {
      setDraft(next);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        setCustomTheme(next);
      }, 100);
    },
    [setCustomTheme]
  );

  const setField = (key: keyof CustomThemeTokens, value: string) => {
    const next = { ...draft, [key]: value };
    if (isValidHex(value)) pushDraft(next);
    else setDraft(next);
  };

  return (
    <div className="mt-8 max-w-2xl">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 text-[12px] font-mono uppercase tracking-wider text-fg-muted hover:text-accent"
      >
        <ChevronDown className={clsx('w-4 h-4 transition-transform', open && 'rotate-180')} />
        Create custom theme
      </button>
      {open && (
        <div className="mt-4 panel p-4 space-y-3">
          <table className="w-full text-[11px]">
            <tbody>
              {TOKEN_ROWS.map((row) => (
                <tr key={row.key} className="border-b border-border-subtle last:border-0">
                  <td className="py-2 font-mono text-fg-subtle w-[140px]">{row.label}</td>
                  <td className="py-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={draft[row.key]}
                        onChange={(e) => setField(row.key, e.target.value)}
                        className="w-8 h-7 border border-border-subtle cursor-pointer p-0"
                        aria-label={row.label}
                      />
                      <input
                        type="text"
                        value={draft[row.key]}
                        onChange={(e) => setField(row.key, e.target.value)}
                        className="input h-7 font-mono text-[11px] flex-1 max-w-[120px]"
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              className="btn btn-primary text-[11px]"
              onClick={() => setCustomTheme(draft)}
            >
              Save as custom theme
            </button>
            <button
              type="button"
              className="text-[11px] font-mono text-fg-muted hover:text-accent"
              onClick={() => {
                setDraft(DEFAULT_CUSTOM);
                setCustomTheme(null);
              }}
            >
              Reset to defaults
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
