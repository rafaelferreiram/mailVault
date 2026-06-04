// Personalization preferences store.
//
// Owns the in-memory copy of `Preferences`, mirrors the saved electron-store
// shape, and is the single place that calls into ThemeEngine. Every setter
// applies its change to <html> instantly and persists with a 500ms debounce
// so spamming a slider doesn't write a thousand times.

import { create } from 'zustand';
import {
  DEFAULT_PREFS,
  DEFAULT_LIVE_SYNC,
  DEFAULT_EMAIL_VIEW,
  type AppearancePrefs,
  type ContentLayout,
  type CustomThemeTokens,
  type DensityStop,
  type EmailViewPrefs,
  type LayoutPrefs,
  type LayoutTemplate,
  type MotionStop,
  type PanelsPrefs,
  type Preferences,
  type LiveSyncPrefs,
  type LiveSyncAutoActionPrefs,
  type LiveSyncNotificationPrefs,
  type SidebarPosition,
  type StyleName,
  type ThemeName,
} from '@shared/types';
import { ThemeEngine, isValidHex } from '@/lib/themeEngine';
import { inferLayoutTemplate, layoutPrefsForTemplate } from '@/lib/layoutTemplates';

interface PrefsState {
  prefs: Preferences;
  loaded: boolean;
  panelOpen: boolean;
  wizardOpen: boolean;

  load: () => Promise<void>;
  setPanelOpen: (open: boolean) => void;
  togglePanel: () => void;
  openWizard: () => void;
  closeWizard: () => void;
  /** First-run gate — opens wizard when prefs.wizard is incomplete. */
  autoLaunchWizardIfNeeded: () => void;
  /** Atomically apply + persist a full preferences object (wizard finish). */
  commitPreferences: (prefs: Preferences) => void;

  setTheme: (theme: ThemeName) => void;
  setStyle: (style: StyleName) => void;
  setAccent: (hex: string) => void;
  setDensity: (d: DensityStop) => void;
  setMotion: (m: MotionStop) => void;
  setReduceMotion: (v: boolean) => void;
  setCustomCss: (css: string) => void;

  setSidebarPosition: (p: SidebarPosition) => void;
  setContentLayout: (l: ContentLayout) => void;
  setLayoutTemplate: (template: LayoutTemplate) => void;
  setLayoutSplitPosition: (px: number) => void;
  patchEmailView: (patch: Partial<EmailViewPrefs>) => void;
  setCustomTheme: (tokens: CustomThemeTokens | null) => void;
  setSidebarItems: (items: LayoutPrefs['sidebarItems']) => void;

  setPanel: <K extends keyof PanelsPrefs>(key: K, on: boolean) => void;

  setLiveSyncEnabled: (on: boolean) => void;
  setLiveSyncInterval: (seconds: number) => void;
  setLiveSyncAdaptive: (on: boolean) => void;
  setLiveSyncAutoAction: <K extends keyof LiveSyncAutoActionPrefs>(key: K, on: boolean) => void;
  setLiveSyncNotification: <K extends keyof LiveSyncNotificationPrefs>(key: K, value: LiveSyncNotificationPrefs[K]) => void;

  markWizardCompleted: () => void;
  markWizardSkipped: () => void;
  resetAll: () => void;
  resetThemeOnly: () => void;
}

// ─── Persistence (debounced) ───────────────────────────────────────────
let writeTimer: ReturnType<typeof setTimeout> | null = null;
const WRITE_DEBOUNCE_MS = 500;

function persistDebounced(prefs: Preferences) {
  if (writeTimer) clearTimeout(writeTimer);
  writeTimer = setTimeout(() => {
    writeTimer = null;
    void window.mailvault.setPreferences(prefs).catch(() => {
      // The store is best-effort; if the write fails (file locked, disk
      // full) we keep the in-memory state and the next change will retry.
    });
  }, WRITE_DEBOUNCE_MS);
}

// ─── Live preview application ─────────────────────────────────────────
// Each setter calls into ThemeEngine BEFORE updating Zustand, so the user
// sees the change in the same paint that fires their click. React state
// follows for any components that need to read the current value.
export const usePrefsStore = create<PrefsState>((set, get) => ({
  prefs: { ...DEFAULT_PREFS },
  loaded: false,
  panelOpen: false,
  wizardOpen: false,

  async load() {
    try {
      const fromMain = await window.mailvault.getPreferences();
      const next = normalizePreferences({
        ...DEFAULT_PREFS,
        ...(fromMain ?? {}),
        liveSync: { ...DEFAULT_LIVE_SYNC, ...(fromMain as Preferences)?.liveSync },
      } as Preferences);
      applyAllPrefs(next);
      set({ prefs: next, loaded: true });
    } catch {
      // Use whatever the no-flash boot already painted; mark loaded so the
      // app proceeds. The user can still edit; saves will retry on next op.
      set({ loaded: true });
    }
  },

  setPanelOpen(open) {
    set({ panelOpen: open });
  },
  togglePanel() {
    set({ panelOpen: !get().panelOpen });
  },

  openWizard() {
    set({ wizardOpen: true });
  },
  closeWizard() {
    set({ wizardOpen: false });
  },

  autoLaunchWizardIfNeeded() {
    const { prefs, loaded, wizardOpen } = get();
    if (!loaded || wizardOpen) return;
    if (prefs.wizard.completed || prefs.wizard.skipped) return;
    set({ wizardOpen: true });
  },

  commitPreferences(prefs) {
    const next = normalizePreferences(prefs);
    applyAllPrefs(next);
    set({ prefs: next });
    persistDebounced(next);
  },

  setTheme(theme) {
    ThemeEngine.applyTheme(theme, { animate: true });
    // When theme changes, drop the user's custom accent override so the
    // new theme's default accent shows through. They can re-pick after.
    ThemeEngine.clearAccentOverride();
    update(set, get, { appearance: { ...get().prefs.appearance, theme, accent: defaultAccentFor(theme) } });
  },

  setStyle(style) {
    ThemeEngine.applyStyle(style);
    update(set, get, { appearance: { ...get().prefs.appearance, style } });
  },

  setAccent(hex) {
    if (!isValidHex(hex)) return;
    ThemeEngine.applyAccent(hex);
    update(set, get, { appearance: { ...get().prefs.appearance, accent: hex } });
  },

  setDensity(density) {
    ThemeEngine.applyDensity(density);
    update(set, get, { appearance: { ...get().prefs.appearance, density } });
  },

  setMotion(motion) {
    const a = get().prefs.appearance;
    ThemeEngine.applyMotion(motion, a.reduceMotion);
    update(set, get, { appearance: { ...a, motion } });
  },

  setReduceMotion(reduceMotion) {
    const a = get().prefs.appearance;
    ThemeEngine.applyMotion(a.motion, reduceMotion);
    update(set, get, { appearance: { ...a, reduceMotion } });
  },

  setCustomCss(css) {
    ThemeEngine.applyCustomCss(css);
    update(set, get, { appearance: { ...get().prefs.appearance, customCss: css } });
  },

  setSidebarPosition(p) {
    ThemeEngine.applySidebarPosition(p);
    update(set, get, { layout: { ...get().prefs.layout, sidebarPosition: p } });
  },

  setContentLayout(l) {
    ThemeEngine.applyContentLayout(l);
    update(set, get, { layout: { ...get().prefs.layout, contentLayout: l } });
  },

  setLayoutTemplate(template) {
    const layout = layoutPrefsForTemplate(template, get().prefs.layout);
    ThemeEngine.applyLayoutTemplate(template);
    update(set, get, { layout });
  },

  setLayoutSplitPosition(px) {
    const splitPosition = Math.round(px);
    const emailView = { ...get().prefs.emailView, splitPosition };
    ThemeEngine.applyEmailView(emailView);
    update(set, get, {
      layout: { ...get().prefs.layout, splitPosition },
      emailView,
    });
  },

  patchEmailView(patch) {
    const emailView = { ...get().prefs.emailView, ...patch };
    ThemeEngine.applyEmailView(emailView);
    update(set, get, { emailView });
  },

  setCustomTheme(tokens) {
    ThemeEngine.applyCustomTheme(tokens);
    const appearance = { ...get().prefs.appearance, customTheme: tokens };
    if (tokens?.accent) ThemeEngine.applyAccent(tokens.accent);
    update(set, get, { appearance });
  },

  setSidebarItems(items) {
    update(set, get, { layout: { ...get().prefs.layout, sidebarItems: items } });
  },

  setPanel(key, on) {
    update(set, get, { panels: { ...get().prefs.panels, [key]: on } });
  },

  setLiveSyncEnabled(on) {
    const liveSync = { ...get().prefs.liveSync, enabled: on };
    update(set, get, { liveSync });
    void window.mailvault.liveSyncSetEnabled(on);
  },

  setLiveSyncInterval(seconds) {
    update(set, get, {
      liveSync: { ...get().prefs.liveSync, pollingIntervalActive: seconds },
    });
  },

  setLiveSyncAdaptive(on) {
    update(set, get, { liveSync: { ...get().prefs.liveSync, adaptivePolling: on } });
  },

  setLiveSyncAutoAction(key, on) {
    const liveSync = {
      ...get().prefs.liveSync,
      autoActions: { ...get().prefs.liveSync.autoActions, [key]: on },
    };
    update(set, get, { liveSync });
  },

  setLiveSyncNotification(key, value) {
    const liveSync = {
      ...get().prefs.liveSync,
      notifications: { ...get().prefs.liveSync.notifications, [key]: value },
    };
    update(set, get, { liveSync });
  },

  markWizardCompleted() {
    update(set, get, { wizard: { completed: true, skipped: false, completedAt: Date.now() } });
  },
  markWizardSkipped() {
    update(set, get, { wizard: { completed: true, skipped: true, completedAt: Date.now() } });
  },

  resetAll() {
    const fresh: Preferences = { ...DEFAULT_PREFS, updatedAt: Date.now() };
    ThemeEngine.clearAccentOverride();
    applyAllPrefs(fresh, { animate: true });
    set({ prefs: fresh });
    persistDebounced(fresh);
  },

  resetThemeOnly() {
    const cur = get().prefs;
    const next: Preferences = {
      ...cur,
      appearance: { ...DEFAULT_PREFS.appearance, customCss: cur.appearance.customCss },
      updatedAt: Date.now(),
    };
    ThemeEngine.clearAccentOverride();
    ThemeEngine.applyAppearance(next.appearance, { animate: true });
    set({ prefs: next });
    persistDebounced(next);
  },
}));

// ─── helpers ───────────────────────────────────────────────────────────
type StoreSet = (
  partial: Partial<PrefsState> | ((s: PrefsState) => Partial<PrefsState>)
) => void;
type StoreGet = () => PrefsState;

function update(
  set: StoreSet,
  get: StoreGet,
  patch: Partial<{
    appearance: AppearancePrefs;
    layout: LayoutPrefs;
    emailView: EmailViewPrefs;
    panels: PanelsPrefs;
    wizard: Preferences['wizard'];
    liveSync: LiveSyncPrefs;
  }>
) {
  const cur = get().prefs;
  const next: Preferences = {
    ...cur,
    ...(patch.appearance ? { appearance: patch.appearance } : {}),
    ...(patch.layout ? { layout: patch.layout } : {}),
    ...(patch.emailView ? { emailView: patch.emailView } : {}),
    ...(patch.panels ? { panels: patch.panels } : {}),
    ...(patch.wizard ? { wizard: patch.wizard } : {}),
    ...(patch.liveSync ? { liveSync: patch.liveSync } : {}),
    updatedAt: Date.now(),
  };
  set({ prefs: next });
  persistDebounced(next);
}

function normalizePreferences(prefs: Preferences): Preferences {
  const emailView = { ...DEFAULT_EMAIL_VIEW, ...prefs.emailView };
  const template = inferLayoutTemplate(prefs.layout);
  const layout = layoutPrefsForTemplate(template, {
    ...prefs.layout,
    splitPosition: prefs.layout.splitPosition ?? emailView.splitPosition,
  });
  return {
    ...prefs,
    appearance: { ...DEFAULT_PREFS.appearance, ...prefs.appearance },
    emailView: { ...emailView, splitPosition: layout.splitPosition },
    layout,
  };
}

function applyAllPrefs(prefs: Preferences, opts: { animate?: boolean } = {}) {
  ThemeEngine.applyAppearance(prefs.appearance, opts);
  ThemeEngine.applyLayoutTemplate(prefs.layout.template);
  ThemeEngine.applyEmailView(prefs.emailView);
}

const THEME_DEFAULT_ACCENT: Record<ThemeName, string> = {
  midnight: '#00d4ff',
  arctic: '#0066cc',
  obsidian: '#bf5af2',
  linen: '#d97706',
  terminal: '#00e676',
  fog: '#475569',
};

function defaultAccentFor(theme: ThemeName): string {
  return THEME_DEFAULT_ACCENT[theme] ?? '#00d4ff';
}
