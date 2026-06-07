import type { Config } from 'tailwindcss';

// Color tokens use the CSS-variable + <alpha-value> pattern so that runtime
// theme switching works without rebuilding any classes:
//
//   bg-accent       → rgb(var(--color-accent) / 1)
//   bg-accent/40    → rgb(var(--color-accent) / 0.4)
//
// The variables are defined per theme in `src/styles/themes.css` on
// `:root[data-theme="…"]`. Switching theme is a single attribute change on
// <html> — every Tailwind color class re-resolves automatically.
//
// Naming convention: --color-{token} stores an "R G B" triplet (no commas,
// no parens) so the rgb() pattern above can substitute it directly.
const cssVar = (name: string) => `rgb(var(${name}) / <alpha-value>)`;

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: cssVar('--color-bg'),
          elevated: cssVar('--color-bg-elevated'),
          surface: cssVar('--color-bg-surface'),
          inset: cssVar('--color-bg-inset'),
          hover: cssVar('--color-bg-hover'),
          row: cssVar('--color-bg-row'),
          rowAlt: cssVar('--color-bg-row-alt'),
        },
        border: {
          DEFAULT: cssVar('--color-border'),
          subtle: cssVar('--color-border-subtle'),
          strong: cssVar('--color-border-strong'),
        },
        fg: {
          DEFAULT: cssVar('--color-fg'),
          muted: cssVar('--color-fg-muted'),
          subtle: cssVar('--color-fg-subtle'),
          dim: cssVar('--color-fg-dim'),
        },
        accent: {
          DEFAULT: cssVar('--color-accent'),
          dim: cssVar('--color-accent-dim'),
          // glow / edge are kept for backwards compat with existing utility
          // classes (`bg-accent-glow`, `border-accent-edge`). They derive
          // their alpha from the same --color-accent triplet.
          glow: 'rgb(var(--color-accent) / 0.16)',
          edge: 'rgb(var(--color-accent) / 0.40)',
        },
        ok: {
          DEFAULT: cssVar('--color-ok'),
          dim: cssVar('--color-ok-dim'),
        },
        warn: {
          DEFAULT: cssVar('--color-warn'),
          dim: cssVar('--color-warn-dim'),
        },
        danger: {
          DEFAULT: cssVar('--color-danger'),
          dim: cssVar('--color-danger-dim'),
        },
        info: {
          DEFAULT: cssVar('--color-info'),
          dim: cssVar('--color-info-dim'),
        },
      },
      borderRadius: {
        none: '0',
        DEFAULT: 'var(--radius, 0)',
        sm: '0',
        md: '1px',
        lg: '2px',
        full: '9999px',
      },
      fontFamily: {
        sans: [
          'IBM Plex Sans',
          'DM Sans',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'sans-serif',
        ],
        mono: [
          'IBM Plex Mono',
          'JetBrains Mono',
          'SF Mono',
          'Menlo',
          'Consolas',
          'monospace',
        ],
        term: [
          'JetBrains Mono',
          'IBM Plex Mono',
          'SF Mono',
          'Menlo',
          'monospace',
        ],
      },
      fontSize: {
        '2xs': ['10px', { lineHeight: '14px' }],
        xs: ['11px', { lineHeight: '15px' }],
        sm: ['12px', { lineHeight: '17px' }],
        base: ['13px', { lineHeight: '19px' }],
        lg: ['15px', { lineHeight: '21px' }],
        xl: ['18px', { lineHeight: '24px' }],
        '2xl': ['22px', { lineHeight: '28px' }],
        '3xl': ['28px', { lineHeight: '34px' }],
      },
      spacing: {
        row: 'var(--row-h, 36px)',
        rowCompact: '28px',
      },
      animation: {
        'log-in': 'logIn 80ms ease-out',
        'fade-in': 'fadeIn 120ms ease-out',
        'flash': 'flash 220ms ease-out',
        'count-pulse': 'countPulse 800ms ease-out',
        'pulse-soft': 'pulseSoft 1.6s ease-in-out infinite',
        'bell-ring': 'bellRing 600ms ease-in-out',
        'badge-pop': 'badgePop 200ms ease-out',
        'dropdown-in': 'dropdownIn 160ms ease-out',
        'modal-in': 'modalIn 180ms ease-out',
        'spin-slow': 'spin 1.2s linear infinite',
        'slide-up-in': 'slideUpIn 280ms ease-out both',
        'sync-pulse': 'syncPulse 2s ease-in-out infinite',
      },
      keyframes: {
        logIn: {
          '0%': { transform: 'translateY(4px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        flash: {
          '0%': { backgroundColor: 'rgb(var(--color-accent) / 0.20)' },
          '100%': { backgroundColor: 'transparent' },
        },
        countPulse: {
          '0%': { color: 'rgb(var(--color-accent))' },
          '100%': { color: 'rgb(var(--color-fg))' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '0.4' },
          '50%': { opacity: '1' },
        },
        bellRing: {
          '0%': { transform: 'rotate(0deg)' },
          '10%': { transform: 'rotate(14deg)' },
          '20%': { transform: 'rotate(-11deg)' },
          '30%': { transform: 'rotate(9deg)' },
          '40%': { transform: 'rotate(-7deg)' },
          '50%': { transform: 'rotate(5deg)' },
          '60%': { transform: 'rotate(-3deg)' },
          '70%': { transform: 'rotate(2deg)' },
          '100%': { transform: 'rotate(0deg)' },
        },
        badgePop: {
          '0%': { transform: 'scale(0)' },
          '60%': { transform: 'scale(1.2)' },
          '100%': { transform: 'scale(1)' },
        },
        dropdownIn: {
          '0%': { transform: 'translateY(-8px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        modalIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        slideUpIn: {
          '0%': { transform: 'translateY(8px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        syncPulse: {
          '0%, 100%': { opacity: '0.45' },
          '50%': { opacity: '1' },
        },
        staggerIn: {
          '0%': { transform: 'translateY(6px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
