import clsx from 'clsx';
import { Check } from 'lucide-react';
export { IosToggle } from '@/components/ui/Switch';
import type {
  ContentLayout,
  DensityStop,
  MotionStop,
  PanelsPrefs,
  SidebarPosition,
  StyleName,
  ThemeName,
} from '@shared/types';

// Shared constants + tiny UI primitives used by both the setup wizard and
// the persistent Personalization Panel. Keeps swatch grids and option lists
// in one place so the two surfaces never drift.

export const THEMES: Array<{ id: ThemeName; label: string; tag: string }> = [
  { id: 'midnight', label: 'Midnight', tag: 'Cool · technical' },
  { id: 'arctic', label: 'Arctic', tag: 'Light · clean' },
  { id: 'obsidian', label: 'Obsidian', tag: 'Warm · premium' },
  { id: 'linen', label: 'Linen', tag: 'Light · editorial' },
  { id: 'terminal', label: 'Terminal', tag: 'Phosphor · raw' },
  { id: 'fog', label: 'Fog', tag: 'Ultra-minimal' },
];

export const STYLES: Array<{ id: StyleName; label: string; desc: string; recommended?: boolean }> =
  [
    { id: 'minimal', label: 'Minimal', desc: 'Breathing room. Less clutter.' },
    { id: 'focused', label: 'Focused', desc: 'Everything in its place.', recommended: true },
    { id: 'detailed', label: 'Detailed', desc: 'Show me everything.' },
    { id: 'editorial', label: 'Editorial', desc: 'Typographic. Refined.' },
    { id: 'warm', label: 'Warm', desc: 'Friendly. Approachable.' },
  ];

export const ACCENT_PRESETS: Array<{ hex: string; label: string }> = [
  { hex: '#00d4ff', label: 'Cyan' },
  { hex: '#bf5af2', label: 'Violet' },
  { hex: '#00e676', label: 'Green' },
  { hex: '#ff6b35', label: 'Flame' },
  { hex: '#ffb300', label: 'Amber' },
  { hex: '#0066cc', label: 'Royal' },
  { hex: '#ff3d57', label: 'Red' },
];

export const SIDEBAR_POSITIONS: Array<{ id: SidebarPosition; label: string; sub: string }> = [
  { id: 'left', label: 'Standard', sub: 'Left sidebar' },
  { id: 'right', label: 'Right-handed', sub: 'Sidebar on right' },
  { id: 'compact', label: 'Maximized', sub: 'Icon-only nav' },
];

export const CONTENT_LAYOUTS: Array<{ id: ContentLayout; label: string; sub: string }> = [
  { id: 'single-pane', label: 'Single Pane', sub: 'Focus on one thing' },
  { id: 'master-detail', label: 'Master · Detail', sub: 'List + detail together' },
  { id: 'dashboard-first', label: 'Dashboard First', sub: 'Overview on load' },
  { id: 'compact-list', label: 'Compact List', sub: 'Maximum rows visible' },
];

export const PANEL_TOGGLES: Array<{ key: keyof PanelsPrefs; label: string }> = [
  { key: 'accountTabs', label: 'Account switcher tabs' },
  { key: 'storageBar', label: 'Storage usage bar' },
  { key: 'syncDrawer', label: 'Sync progress drawer' },
  { key: 'suggestionFeed', label: 'Suggestion feed' },
  { key: 'keyboardHints', label: 'Keyboard shortcut hints' },
  { key: 'emailBadges', label: 'Email count badges' },
  { key: 'statsCards', label: 'Quick stats cards' },
  { key: 'welcomeGreeting', label: 'Welcome greeting' },
];

export const DENSITY_STOPS: Array<{ id: DensityStop; label: string; value: number }> = [
  { id: 'compact', label: 'Compact', value: 0 },
  { id: 'normal', label: 'Normal', value: 0.5 },
  { id: 'spacious', label: 'Spacious', value: 1 },
];

export const MOTION_STOPS: Array<{ id: MotionStop; label: string }> = [
  { id: 'instant', label: 'Instant' },
  { id: 'normal', label: 'Normal' },
  { id: 'slow', label: 'Slow' },
];

/** Tiny theme swatch — paints using real CSS vars scoped under data-theme. */
export function ThemeSwatch({
  theme,
  className,
}: {
  theme: ThemeName;
  className?: string;
}) {
  return (
    <div
      data-theme={theme}
      className={clsx(
        'relative overflow-hidden border border-[rgb(var(--color-border))]',
        className
      )}
      aria-hidden
    >
      <div className="absolute inset-0 bg-[rgb(var(--color-bg))]" />
      <div className="absolute top-0 left-0 bottom-0 w-[18%] bg-[rgb(var(--color-bg-elevated))] border-r border-[rgb(var(--color-border-subtle))]" />
      <div className="absolute top-[18%] left-[22%] right-[8%] h-[8%] bg-[rgb(var(--color-fg-muted)/0.35)]" />
      <div className="absolute top-[38%] left-[22%] w-[20%] h-[8%] bg-[rgb(var(--color-accent))]" />
      <div className="absolute top-[38%] left-[45%] right-[8%] h-[8%] bg-[rgb(var(--color-fg-muted)/0.2)]" />
      <div className="absolute top-[58%] left-[22%] right-[8%] h-[8%] bg-[rgb(var(--color-fg-muted)/0.15)]" />
    </div>
  );
}

export function ThemeSwatchGrid({
  selected,
  onSelect,
  onHover,
  size = 'md',
}: {
  selected: ThemeName;
  onSelect: (t: ThemeName) => void;
  onHover?: (t: ThemeName | null) => void;
  size?: 'sm' | 'md' | 'lg';
}) {
  const h = size === 'lg' ? 'h-[100px]' : size === 'md' ? 'h-[68px]' : 'h-[56px]';
  return (
    <div className="grid grid-cols-3 gap-2">
      {THEMES.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onSelect(t.id)}
          onMouseEnter={() => onHover?.(t.id)}
          onMouseLeave={() => onHover?.(null)}
          onFocus={() => onHover?.(t.id)}
          onBlur={() => onHover?.(null)}
          className={clsx(
            'relative flex flex-col p-1.5 transition-colors text-left border',
            h,
            selected === t.id
              ? 'border-accent shadow-[0_0_0_1px_rgb(var(--color-accent)/0.4)]'
              : 'border-border-subtle hover:border-border-strong'
          )}
          title={`${t.label} — ${t.tag}`}
        >
          <ThemeSwatch theme={t.id} className="flex-1 min-h-0 w-full" />
          <div className="mt-auto flex items-center gap-1 pt-1">
            <span className="text-[10px] font-mono text-fg truncate">{t.label}</span>
            {selected === t.id && <Check className="w-2.5 h-2.5 text-accent ml-auto" />}
          </div>
        </button>
      ))}
    </div>
  );
}

export function StyleCardGrid({
  selected,
  onSelect,
  onHover,
}: {
  selected: StyleName;
  onSelect: (s: StyleName) => void;
  onHover?: (s: StyleName | null) => void;
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {STYLES.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() => onSelect(s.id)}
          onMouseEnter={() => onHover?.(s.id)}
          onMouseLeave={() => onHover?.(null)}
          className={clsx(
            'flex flex-col p-2 border text-left transition-colors min-h-[130px]',
            selected === s.id
              ? 'border-accent bg-accent/5'
              : 'border-border-subtle hover:border-border-strong hover:bg-bg-hover'
          )}
        >
          <StyleMiniMock style={s.id} />
          <div className="mt-2 flex items-center gap-1">
            <span className="text-[11px] font-medium text-fg">{s.label}</span>
            {s.recommended && (
              <span className="text-[8px] font-mono uppercase tracking-wider text-accent">
                rec
              </span>
            )}
          </div>
          <span className="text-[10px] text-fg-muted mt-0.5 line-clamp-2">{s.desc}</span>
        </button>
      ))}
    </div>
  );
}

function StyleMiniMock({ style }: { style: StyleName }) {
  const bar = 'bg-fg-dim';
  if (style === 'minimal') {
    return (
      <div className="flex-1 flex flex-col justify-center gap-3 py-2">
        <div className={`h-px w-full ${bar}`} />
        <div className={`h-px w-3/4 ${bar}`} />
        <div className={`h-px w-1/2 ${bar}`} />
      </div>
    );
  }
  if (style === 'detailed') {
    return (
      <div className="flex-1 flex gap-px border border-border-subtle">
        <div className="w-3 bg-bg-hover" />
        <div className="flex-1 flex flex-col gap-px p-0.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex gap-px flex-1">
              <div className={`flex-1 ${bar}`} />
              <div className={`w-2 ${bar}`} />
              <div className={`w-2 ${bar}`} />
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (style === 'editorial') {
    return (
      <div className="flex-1 flex flex-col justify-center gap-1 py-1">
        <div className="h-2 w-2/3 bg-fg-muted/50" />
        <div className={`h-px w-full ${bar}`} />
        <div className={`h-px w-4/5 ${bar} opacity-60`} />
      </div>
    );
  }
  if (style === 'warm') {
    return (
      <div className="flex-1 flex gap-1 items-end pb-1">
        <div className="w-8 h-10 border border-border bg-bg-hover" />
        <div className="w-8 h-8 border border-border bg-bg-hover" />
      </div>
    );
  }
  // focused (default)
  return (
    <div className="flex-1 flex gap-1">
      <div className="w-3 bg-accent/30 border-r border-accent/40" />
      <div className="flex-1 flex flex-col gap-px justify-center">
        <div className={`h-2 w-full bg-accent/20`} />
        <div className={`h-2 w-full ${bar}`} />
        <div className={`h-2 w-full ${bar}`} />
      </div>
    </div>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  disabled,
}: {
  options: Array<{ id: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
  disabled?: boolean;
}) {
  return (
    <div
      className={clsx(
        'inline-flex w-full border border-border bg-bg-inset',
        disabled && 'opacity-40 pointer-events-none'
      )}
    >
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={clsx(
            'flex-1 px-2 h-7 text-[11px] font-mono uppercase tracking-wider transition-colors',
            value === o.id
              ? 'bg-accent/15 text-accent'
              : 'text-fg-muted hover:text-fg hover:bg-bg-hover'
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function WizardDots({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex items-center gap-2" aria-label={`Step ${step} of ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={clsx(
            'w-1.5 h-1.5 rounded-full transition-colors',
            i + 1 === step ? 'bg-accent' : i + 1 < step ? 'bg-fg-muted' : 'bg-fg-dim'
          )}
        />
      ))}
    </div>
  );
}
