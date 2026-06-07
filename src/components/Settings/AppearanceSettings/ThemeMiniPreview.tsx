import type { ThemeName } from '@shared/types';

/** Hardcoded mini-app colors per theme (Slack-style full preview). */
export const THEME_PREVIEW: Record<
  ThemeName,
  {
    sidebar: string;
    topBar: string;
    content: string;
    rowA: string;
    rowB: string;
    accent: string;
    text: string;
    isDark: boolean;
  }
> = {
  midnight: {
    sidebar: '#0f1318',
    topBar: '#080b0f',
    content: '#080b0f',
    rowA: '#111820',
    rowB: '#0a0e14',
    accent: '#00d4ff',
    text: '#e8edf3',
    isDark: true,
  },
  arctic: {
    sidebar: '#e8eef4',
    topBar: '#ffffff',
    content: '#f5f7fa',
    rowA: '#eef3f8',
    rowB: '#ffffff',
    accent: '#0066cc',
    text: '#141c28',
    isDark: false,
  },
  obsidian: {
    sidebar: '#1a1524',
    topBar: '#0f0c14',
    content: '#0f0c14',
    rowA: '#181222',
    rowB: '#120e18',
    accent: '#bf5af2',
    text: '#f0ebf5',
    isDark: true,
  },
  linen: {
    sidebar: '#e5ddd0',
    topBar: '#faf7f2',
    content: '#faf7f2',
    rowA: '#f5efe6',
    rowB: '#fffaf4',
    accent: '#d97706',
    text: '#322816',
    isDark: false,
  },
  terminal: {
    sidebar: '#0a140a',
    topBar: '#020402',
    content: '#020402',
    rowA: '#081008',
    rowB: '#040804',
    accent: '#00e676',
    text: '#d2e6d2',
    isDark: true,
  },
  fog: {
    sidebar: '#ececee',
    topBar: '#ffffff',
    content: '#f8f8fa',
    rowA: '#f2f2f4',
    rowB: '#ffffff',
    accent: '#475569',
    text: '#1e1e24',
    isDark: false,
  },
};

const LABELS: Record<ThemeName, string> = {
  midnight: 'Midnight',
  arctic: 'Arctic',
  obsidian: 'Obsidian',
  linen: 'Linen',
  terminal: 'Terminal',
  fog: 'Fog',
};

export function ThemeMiniPreview({ theme }: { theme: ThemeName }) {
  const c = THEME_PREVIEW[theme];
  return (
    <svg viewBox="0 0 240 130" className="w-full h-full" aria-hidden preserveAspectRatio="xMidYMid slice">
      <rect width={240} height={130} fill={c.content} />
      <rect x={0} y={0} width={52} height={130} fill={c.sidebar} />
      <rect x={56} y={8} width={176} height={16} fill={c.topBar} rx={2} stroke={c.isDark ? '#1e2836' : '#d1d9e2'} strokeWidth={0.5} />
      <rect x={56} y={30} width={48} height={8} fill={c.accent} rx={2} />
      <rect x={56} y={44} width={96} height={6} fill={c.text} opacity={0.35} rx={1} />
      <rect x={56} y={58} width={176} height={14} fill={c.rowA} rx={2} />
      <rect x={64} y={62} width={72} height={6} fill={c.text} opacity={0.55} rx={1} />
      <rect x={56} y={76} width={176} height={14} fill={c.rowB} rx={2} />
      <rect x={64} y={80} width={56} height={6} fill={c.text} opacity={0.4} rx={1} />
      <rect x={56} y={94} width={176} height={14} fill={c.rowA} rx={2} />
      <rect x={56} y={112} width={176} height={10} fill={c.accent} opacity={0.18} rx={2} />
      <circle cx={20} cy={22} r={4} fill={c.accent} />
      <rect x={12} y={36} width={28} height={4} fill={c.text} opacity={0.25} rx={1} />
      <rect x={12} y={46} width={24} height={4} fill={c.text} opacity={0.18} rx={1} />
    </svg>
  );
}

export function ThemePaletteStrip({ theme }: { theme: ThemeName }) {
  const c = THEME_PREVIEW[theme];
  const chips = [
    { color: c.content, label: 'Background' },
    { color: c.sidebar, label: 'Sidebar' },
    { color: c.accent, label: 'Accent' },
    { color: c.text, label: 'Text' },
  ];

  return (
    <div className="theme-card__palette" aria-hidden>
      {chips.map((chip) => (
        <span
          key={chip.label}
          className="theme-card__swatch"
          style={{ backgroundColor: chip.color }}
          title={chip.label}
        />
      ))}
    </div>
  );
}

export function themeLabel(theme: ThemeName): string {
  return LABELS[theme];
}

export function themeModeLabel(theme: ThemeName): 'Dark' | 'Light' {
  return THEME_PREVIEW[theme].isDark ? 'Dark' : 'Light';
}

export const DARK_THEMES: ThemeName[] = ['midnight', 'obsidian', 'terminal'];
export const LIGHT_THEMES: ThemeName[] = ['arctic', 'linen', 'fog'];
