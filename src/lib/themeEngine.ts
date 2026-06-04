// ThemeEngine — applies appearance/layout choices to <html> in O(1) DOM ops.
//
// Every change is a single attribute or inline-style write on
// document.documentElement. CSS variable cascade does the rest, so React
// never re-renders for visual changes. ~16ms first-frame impact even on
// dense screens.
//
// Persistence is *not* this module's job — call sites should both apply()
// and persist() (the prefs store does both with a debounce).

import type {
  AppearancePrefs,
  ContentLayout,
  CustomThemeTokens,
  DensityStop,
  EmailViewPrefs,
  LayoutTemplate,
  MotionStop,
  SidebarPosition,
  StyleName,
  ThemeName,
} from '@shared/types';
import { LAYOUT_TEMPLATE_CONFIG } from '@/lib/layoutTemplates';

// ─── Hex → "R G B" triplet ─────────────────────────────────────────────
// We store accent as "0 212 255" so Tailwind's `bg-accent/40` pattern
// (rgb(var(--color-accent) / 0.4)) composes cleanly. Returns null on
// invalid input so callers can decide what to do (we currently no-op).
export function hexToTriplet(hex: string): string | null {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `${r} ${g} ${b}`;
}

export function isValidHex(hex: string): boolean {
  return hexToTriplet(hex) !== null;
}

// ─── Engine ───────────────────────────────────────────────────────────
class ThemeEngineImpl {
  private get root(): HTMLElement {
    return document.documentElement;
  }

  /** Applies the theme palette by setting `data-theme` on <html>. The
   *  CSS in themes.css then re-resolves all `--color-*` vars. Optional
   *  fade transition softens a manual swap (suppress on initial boot). */
  applyTheme(theme: ThemeName, opts: { animate?: boolean } = {}): void {
    if (opts.animate) {
      this.root.classList.add('theme-transition');
      window.setTimeout(() => this.root.classList.remove('theme-transition'), 200);
    }
    this.root.setAttribute('data-theme', theme);
  }

  applyStyle(style: StyleName): void {
    this.root.setAttribute('data-style', style);
  }

  applyDensity(density: DensityStop): void {
    this.root.setAttribute('data-density', density);
  }

  applyMotion(motion: MotionStop, reduceMotion: boolean): void {
    // `reduceMotion` is the user's explicit override — wins over speed pick.
    this.root.setAttribute('data-motion', reduceMotion ? 'off' : motion);
  }

  /** Accent override. Writes a "R G B" triplet so alpha utilities still work. */
  applyAccent(hex: string): void {
    const triplet = hexToTriplet(hex);
    if (!triplet) return;
    this.root.style.setProperty('--color-accent', triplet);
  }

  /** Reset accent to the theme's default (clears the inline override). */
  clearAccentOverride(): void {
    this.root.style.removeProperty('--color-accent');
  }

  applySidebarPosition(pos: SidebarPosition): void {
    this.root.setAttribute('data-sidebar', pos);
  }

  applyContentLayout(layout: ContentLayout): void {
    this.root.setAttribute('data-layout', layout);
  }

  /** Full layout template — cross-fade then snap panels. */
  applyLayoutTemplate(template: LayoutTemplate): void {
    this.root.classList.add('layout-transition');
    window.setTimeout(() => this.root.classList.remove('layout-transition'), 220);
    this.root.setAttribute('data-layout-template', template);
    const cfg = LAYOUT_TEMPLATE_CONFIG[template];
    this.applySidebarPosition(cfg.sidebarPosition);
    this.applyContentLayout(cfg.contentLayout);
  }

  applyEmailView(ev: EmailViewPrefs): void {
    this.root.setAttribute('data-reading-pane', ev.readingPane);
    this.root.setAttribute('data-email-density', ev.listDensity);
    this.root.setAttribute('data-email-preview-lines', String(ev.previewLines));
    this.root.setAttribute('data-email-unread-style', ev.unreadStyle);
    this.root.setAttribute('data-email-line-spacing', ev.lineSpacing);
    this.root.style.setProperty('--email-split-size', `${ev.splitPosition}px`);
    this.root.style.setProperty('--email-reading-font-size', `${ev.fontSize}px`);
    const lh = ev.lineSpacing === 'tight' ? '1.4' : ev.lineSpacing === 'relaxed' ? '1.9' : '1.6';
    this.root.style.setProperty('--email-reading-line-height', lh);
  }

  applyCustomTheme(tokens: CustomThemeTokens | null): void {
    const vars = [
      '--color-bg',
      '--color-bg-surface',
      '--color-bg-elevated',
      '--color-border',
      '--color-fg',
      '--color-fg-muted',
      '--color-accent',
    ];
    if (!tokens) {
      this.root.removeAttribute('data-custom-theme');
      for (const v of vars) this.root.style.removeProperty(v);
      return;
    }
    this.root.setAttribute('data-custom-theme', '1');
    const map: Array<[keyof CustomThemeTokens, string]> = [
      ['bgBase', '--color-bg'],
      ['bgSurface', '--color-bg-surface'],
      ['bgElevated', '--color-bg-elevated'],
      ['border', '--color-border'],
      ['textPrimary', '--color-fg'],
      ['textMuted', '--color-fg-muted'],
      ['accent', '--color-accent'],
    ];
    for (const [key, cssVar] of map) {
      const triplet = hexToTriplet(tokens[key]);
      if (triplet) this.root.style.setProperty(cssVar, triplet);
    }
  }

  applyCustomCss(css: string): void {
    let el = document.getElementById('mv-custom-css') as HTMLStyleElement | null;
    if (!el) {
      el = document.createElement('style');
      el.id = 'mv-custom-css';
      document.head.appendChild(el);
    }
    el.textContent = css ?? '';
  }

  /** Apply a full appearance block in one go. Used at boot + after reset. */
  applyAppearance(a: AppearancePrefs, opts: { animate?: boolean } = {}): void {
    this.applyTheme(a.theme, opts);
    this.applyStyle(a.style);
    this.applyDensity(a.density);
    this.applyMotion(a.motion, a.reduceMotion);
    if (a.customTheme) {
      this.applyCustomTheme(a.customTheme);
    } else if (a.accent) {
      this.applyAccent(a.accent);
    }
    this.applyCustomCss(a.customCss);
  }
}

export const ThemeEngine = new ThemeEngineImpl();
