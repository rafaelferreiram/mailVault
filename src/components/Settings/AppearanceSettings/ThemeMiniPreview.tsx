import type { ThemeName } from '@shared/types';

/** Hardcoded mini-app colors per theme (Slack-style full preview). */
const THEME_PREVIEW: Record<
  ThemeName,
  {
    sidebar: string;
    topBar: string;
    content: string;
    rowA: string;
    rowB: string;
    accent: string;
    isDark: boolean;
  }
> = {
  midnight: {
    sidebar: '#0f1318',
    topBar: '#080b0f',
    content: '#080b0f',
    rowA: '#0f1318',
    rowB: '#080b0f',
    accent: '#00d4ff',
    isDark: true,
  },
  arctic: {
    sidebar: '#f0f4f8',
    topBar: '#ffffff',
    content: '#ffffff',
    rowA: '#f8f9fa',
    rowB: '#ffffff',
    accent: '#0066cc',
    isDark: false,
  },
  obsidian: {
    sidebar: '#141415',
    topBar: '#0d0d0e',
    content: '#0d0d0e',
    rowA: '#141415',
    rowB: '#0d0d0e',
    accent: '#bf5af2',
    isDark: true,
  },
  linen: {
    sidebar: '#ede8df',
    topBar: '#faf7f2',
    content: '#faf7f2',
    rowA: '#faf7f2',
    rowB: '#f5f0e8',
    accent: '#b85c1a',
    isDark: false,
  },
  terminal: {
    sidebar: '#060d06',
    topBar: '#020402',
    content: '#020402',
    rowA: '#060d06',
    rowB: '#020402',
    accent: '#00ff41',
    isDark: true,
  },
  fog: {
    sidebar: '#f0f0f0',
    topBar: '#ffffff',
    content: '#ffffff',
    rowA: '#f8f8f8',
    rowB: '#ffffff',
    accent: '#111111',
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
    <svg viewBox="0 0 240 130" className="w-full h-full" aria-hidden>
      <rect width={240} height={130} fill={c.content} />
      <rect x={0} y={0} width={44} height={130} fill={c.sidebar} />
      <rect x={48} y={6} width={188} height={14} fill={c.topBar} rx={2} />
      <rect x={48} y={24} width={36} height={6} fill={c.accent} opacity={0.9} rx={1} />
      <rect x={48} y={36} width={80} height={5} fill={c.isDark ? '#4a5568' : '#94a3b8'} rx={1} />
      <rect x={48} y={48} width={188} height={12} fill={c.rowA} rx={2} />
      <rect x={48} y={64} width={188} height={12} fill={c.rowB} rx={2} />
      <rect x={48} y={80} width={188} height={12} fill={c.rowA} rx={2} />
      <rect x={48} y={96} width={188} height={12} fill={c.rowB} rx={2} />
      <rect x={0} y={118} width={240} height={12} fill={c.sidebar} opacity={0.85} />
    </svg>
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
