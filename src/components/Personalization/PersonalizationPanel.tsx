import { useEffect, useMemo, useState, useRef } from 'react';
import { X, Check, Palette, Layout as LayoutIcon, Gauge, Wind, GripVertical, Code2, Activity } from 'lucide-react';
import clsx from 'clsx';
import type {
  ContentLayout,
  DensityStop,
  MotionStop,
  SidebarPosition,
  StyleName,
  ThemeName,
} from '@shared/types';
import { usePrefsStore } from '@/stores/prefsStore';
import { isValidHex } from '@/lib/themeEngine';
import { Button } from '@/components/ui/Button';
import { IosToggle, PANEL_TOGGLES } from './shared';

// Personalization Panel — slides in from the right at 380px wide.
// The app behind it stays live; ThemeEngine paints every change instantly,
// so the user sees their selections in the actual app, not a mock preview.

const THEMES: Array<{ id: ThemeName; label: string; tag: string }> = [
  { id: 'midnight', label: 'Midnight', tag: 'Cool · technical' },
  { id: 'arctic', label: 'Arctic', tag: 'Light · clean' },
  { id: 'obsidian', label: 'Obsidian', tag: 'Warm · premium' },
  { id: 'linen', label: 'Linen', tag: 'Light · editorial' },
  { id: 'terminal', label: 'Terminal', tag: 'Phosphor · raw' },
  { id: 'fog', label: 'Fog', tag: 'Ultra-minimal' },
];

const STYLES: Array<{ id: StyleName; label: string; desc: string }> = [
  { id: 'minimal', label: 'Minimal', desc: 'Less clutter, generous whitespace' },
  { id: 'focused', label: 'Focused', desc: 'Balanced density · default' },
  { id: 'detailed', label: 'Detailed', desc: 'Maximum information, compact rows' },
  { id: 'editorial', label: 'Editorial', desc: 'Typography-led, refined spacing' },
  { id: 'warm', label: 'Warm', desc: 'Softer shapes, friendlier feel' },
];

const ACCENT_PRESETS: Array<{ hex: string; label: string }> = [
  { hex: '#00d4ff', label: 'Cyan' },
  { hex: '#bf5af2', label: 'Violet' },
  { hex: '#00e676', label: 'Green' },
  { hex: '#ff6b35', label: 'Flame' },
  { hex: '#ffb300', label: 'Amber' },
  { hex: '#0066cc', label: 'Royal' },
  { hex: '#ff3d57', label: 'Red' },
  { hex: '#475569', label: 'Slate' },
];

const SIDEBAR_POSITIONS: Array<{ id: SidebarPosition; label: string; sub: string }> = [
  { id: 'left', label: 'Left', sub: 'Standard' },
  { id: 'right', label: 'Right', sub: 'Right-handed' },
  { id: 'compact', label: 'Compact', sub: 'Icon-only' },
];

const CONTENT_LAYOUTS: Array<{ id: ContentLayout; label: string; sub: string }> = [
  { id: 'single-pane', label: 'Single Pane', sub: 'Focus on one thing' },
  { id: 'master-detail', label: 'Master · Detail', sub: 'List + detail together' },
  { id: 'dashboard-first', label: 'Dashboard First', sub: 'Overview on load' },
  { id: 'compact-list', label: 'Compact List', sub: 'Maximum rows' },
];

const DENSITY_STOPS: Array<{ id: DensityStop; label: string }> = [
  { id: 'compact', label: 'Compact' },
  { id: 'normal', label: 'Normal' },
  { id: 'spacious', label: 'Spacious' },
];

const MOTION_STOPS: Array<{ id: MotionStop; label: string }> = [
  { id: 'instant', label: 'Instant' },
  { id: 'normal', label: 'Normal' },
  { id: 'slow', label: 'Slow' },
];

export function PersonalizationPanel() {
  const open = usePrefsStore((s) => s.panelOpen);
  const close = usePrefsStore((s) => s.setPanelOpen);

  // Esc closes the drawer.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);

  if (!open) return null;

  return (
    // No backdrop opacity: the live app behind is part of the experience.
    // The drawer has a left-edge accent border so it reads as a layer.
    <div
      className="fixed inset-y-0 right-0 z-40 w-[380px] flex flex-col bg-bg-elevated border-l border-border shadow-[-12px_0_28px_rgba(0,0,0,0.35)] animate-fade-in"
      role="dialog"
      aria-modal="false"
      aria-label="Personalization"
    >
      <Header onClose={() => close(false)} />
      <div className="flex-1 overflow-y-auto">
        <SectionTheme />
        <SectionStyle />
        <SectionAccent />
        <SectionLayout />
        <SectionPanels />
        <SectionSidebarItems />
        <SectionDensity />
        <SectionMotion />
        <SectionLiveSync />
        <SectionCustomCss />
        <SectionReset />
      </div>
    </div>
  );
}

function Header({ onClose }: { onClose: () => void }) {
  return (
    <div className="px-4 h-11 border-b border-border bg-bg flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Palette className="w-3.5 h-3.5 text-accent" />
        <div>
          <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-fg">
            Personalization
          </div>
          <div className="text-[10px] text-fg-subtle font-mono">Changes apply instantly</div>
        </div>
      </div>
      <button
        onClick={onClose}
        className="text-fg-subtle hover:text-fg p-1"
        title="Close (Esc)"
        aria-label="Close personalization"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ─── Section frame ─────────────────────────────────────────────────────
function Section({
  icon,
  label,
  hint,
  children,
}: {
  icon?: React.ReactNode;
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="px-4 py-4 border-b border-border-subtle">
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h3 className="label-mono">{label}</h3>
        {hint && <span className="text-[10px] text-fg-subtle font-mono">· {hint}</span>}
      </div>
      {children}
    </section>
  );
}

// ─── Theme grid ────────────────────────────────────────────────────────
function SectionTheme() {
  const theme = usePrefsStore((s) => s.prefs.appearance.theme);
  const setTheme = usePrefsStore((s) => s.setTheme);
  return (
    <Section icon={<Palette className="w-3.5 h-3.5 text-fg-muted" />} label="Color theme">
      <div className="grid grid-cols-3 gap-2">
        {THEMES.map((t) => (
          <button
            key={t.id}
            onClick={() => setTheme(t.id)}
            className={clsx(
              'relative h-[68px] flex flex-col p-1.5 transition-colors text-left border',
              theme === t.id
                ? 'border-accent bg-bg-hover'
                : 'border-border-subtle hover:border-border-strong'
            )}
            title={`${t.label} — ${t.tag}`}
          >
            <ThemeSwatch theme={t.id} />
            <div className="mt-auto flex items-center gap-1 pt-1">
              <span className="text-[10px] font-mono text-fg truncate">{t.label}</span>
              {theme === t.id && <Check className="w-2.5 h-2.5 text-accent ml-auto" />}
            </div>
          </button>
        ))}
      </div>
    </Section>
  );
}

// Renders a tiny live-ish preview of each theme using the theme's actual
// CSS variables. Because the variables are scoped under [data-theme="…"]
// and our wrapper sets that attribute, the swatch always paints in the
// REAL theme's colors regardless of the currently active theme. No JS.
function ThemeSwatch({ theme }: { theme: ThemeName }) {
  return (
    <div
      data-theme={theme}
      className="relative h-7 w-full overflow-hidden border border-[rgb(var(--color-border))]"
      aria-hidden
    >
      <div className="absolute inset-0 bg-[rgb(var(--color-bg))]" />
      <div className="absolute top-0 left-0 bottom-0 w-2 bg-[rgb(var(--color-bg-elevated))] border-r border-[rgb(var(--color-border-subtle))]" />
      <div className="absolute top-1.5 left-3 right-1 h-1 bg-[rgb(var(--color-fg-muted)/0.4)]" />
      <div className="absolute top-3.5 left-3 w-3 h-1 bg-[rgb(var(--color-accent))]" />
      <div className="absolute top-3.5 left-7 right-1 h-1 bg-[rgb(var(--color-fg-muted)/0.25)]" />
    </div>
  );
}

// ─── Style radios ─────────────────────────────────────────────────────
function SectionStyle() {
  const style = usePrefsStore((s) => s.prefs.appearance.style);
  const setStyle = usePrefsStore((s) => s.setStyle);
  return (
    <Section label="Interface style">
      <div className="space-y-1">
        {STYLES.map((s) => (
          <button
            key={s.id}
            onClick={() => setStyle(s.id)}
            className={clsx(
              'w-full flex items-center gap-3 px-2 py-1.5 text-left border transition-colors',
              style === s.id
                ? 'border-accent/40 bg-accent/5'
                : 'border-transparent hover:bg-bg-hover'
            )}
          >
            <span
              className={clsx(
                'w-3 h-3 rounded-full border-2 shrink-0 transition-colors',
                style === s.id ? 'border-accent bg-accent' : 'border-fg-subtle'
              )}
              aria-hidden
            />
            <div className="flex-1 min-w-0">
              <div className="text-[12px] text-fg">{s.label}</div>
              <div className="text-[10px] text-fg-muted truncate">{s.desc}</div>
            </div>
          </button>
        ))}
      </div>
    </Section>
  );
}

// ─── Accent picker ────────────────────────────────────────────────────
function SectionAccent() {
  const accent = usePrefsStore((s) => s.prefs.appearance.accent);
  const setAccent = usePrefsStore((s) => s.setAccent);
  const [draft, setDraft] = useState(accent);
  // Keep custom-input draft in sync when the theme reset changes the accent.
  useEffect(() => setDraft(accent), [accent]);

  const draftValid = useMemo(() => isValidHex(draft), [draft]);

  return (
    <Section label="Accent color" hint="used by buttons, highlights, progress">
      <div className="grid grid-cols-8 gap-1.5 mb-3">
        {ACCENT_PRESETS.map((p) => (
          <button
            key={p.hex}
            onClick={() => setAccent(p.hex)}
            title={`${p.label} · ${p.hex}`}
            aria-label={p.label}
            className={clsx(
              'relative h-6 w-full border transition-transform',
              accent.toLowerCase() === p.hex.toLowerCase()
                ? 'border-fg scale-105'
                : 'border-border-subtle hover:border-border-strong'
            )}
            style={{ background: p.hex }}
          >
            {accent.toLowerCase() === p.hex.toLowerCase() && (
              <Check className="w-3 h-3 text-bg absolute inset-0 m-auto" />
            )}
          </button>
        ))}
      </div>
      <label className="flex items-center gap-2 text-[11px] text-fg-muted">
        <span className="font-mono uppercase tracking-wider text-[10px]">Custom</span>
        <input
          type="text"
          value={draft}
          onChange={(e) => {
            const v = e.target.value;
            setDraft(v);
            if (isValidHex(v)) setAccent(v);
          }}
          placeholder="#00d4ff"
          spellCheck={false}
          className={clsx(
            'flex-1 input h-7 font-mono text-[11px]',
            !draftValid && draft && 'border-danger/50 text-danger'
          )}
        />
        <span
          className="w-5 h-5 border border-border"
          style={{ background: draftValid ? draft : 'transparent' }}
          aria-hidden
        />
      </label>
      <AccentPreview />
    </Section>
  );
}

// Live preview of the accent applied to four canonical surfaces.
function AccentPreview() {
  return (
    <div className="mt-3 grid grid-cols-2 gap-2 text-[10px]">
      <div className="border border-border-subtle px-2 h-6 flex items-center gap-2 bg-accent/5">
        <span className="w-1 h-3 bg-accent" />
        <span className="text-fg">Active nav</span>
      </div>
      <div className="border border-border-subtle h-6 flex items-center px-2">
        <div className="h-1 flex-1 bg-bg-hover">
          <div className="h-full w-2/3 bg-accent" />
        </div>
      </div>
      <button className="btn btn-primary !h-6 !px-2 text-[9px] pointer-events-none">
        Primary
      </button>
      <div className="border border-border-subtle px-2 h-6 flex items-center gap-2">
        <span className="w-3 h-3 border-2 border-accent bg-accent flex items-center justify-center">
          <Check className="w-2 h-2 text-bg" />
        </span>
        <span className="text-fg">Selected</span>
      </div>
    </div>
  );
}

// ─── Layout ───────────────────────────────────────────────────────────
function SectionLayout() {
  const sidebar = usePrefsStore((s) => s.prefs.layout.sidebarPosition);
  const layout = usePrefsStore((s) => s.prefs.layout.contentLayout);
  const setSidebar = usePrefsStore((s) => s.setSidebarPosition);
  const setLayout = usePrefsStore((s) => s.setContentLayout);

  return (
    <Section icon={<LayoutIcon className="w-3.5 h-3.5 text-fg-muted" />} label="Layout">
      <div className="text-[10px] uppercase font-mono tracking-wider text-fg-subtle mb-1.5">
        Sidebar
      </div>
      <div className="grid grid-cols-3 gap-1.5 mb-3">
        {SIDEBAR_POSITIONS.map((p) => (
          <button
            key={p.id}
            onClick={() => setSidebar(p.id)}
            className={clsx(
              'flex flex-col items-center gap-1 py-2 border text-[10px] transition-colors',
              sidebar === p.id
                ? 'border-accent bg-accent/5 text-fg'
                : 'border-border-subtle text-fg-muted hover:text-fg hover:border-border-strong'
            )}
          >
            <SidebarDiagram pos={p.id} active={sidebar === p.id} />
            <span className="font-mono">{p.label}</span>
            <span className="text-[9px] text-fg-subtle">{p.sub}</span>
          </button>
        ))}
      </div>

      <div className="text-[10px] uppercase font-mono tracking-wider text-fg-subtle mb-1.5">
        Content
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {CONTENT_LAYOUTS.map((l) => (
          <button
            key={l.id}
            onClick={() => setLayout(l.id)}
            className={clsx(
              'flex flex-col items-start gap-1 py-2 px-2 border text-[10px] transition-colors text-left',
              layout === l.id
                ? 'border-accent bg-accent/5 text-fg'
                : 'border-border-subtle text-fg-muted hover:text-fg hover:border-border-strong'
            )}
          >
            <ContentLayoutDiagram id={l.id} active={layout === l.id} />
            <span className="font-mono">{l.label}</span>
            <span className="text-[9px] text-fg-subtle">{l.sub}</span>
          </button>
        ))}
      </div>
    </Section>
  );
}

function SidebarDiagram({ pos, active }: { pos: SidebarPosition; active: boolean }) {
  const fill = active ? 'bg-accent/40' : 'bg-fg-dim';
  return (
    <div className="w-12 h-7 border border-border-subtle relative bg-bg">
      {pos === 'left' && <div className={`absolute inset-y-0 left-0 w-2.5 ${fill}`} />}
      {pos === 'right' && <div className={`absolute inset-y-0 right-0 w-2.5 ${fill}`} />}
      {pos === 'compact' && <div className={`absolute inset-y-0 left-0 w-1 ${fill}`} />}
    </div>
  );
}

function ContentLayoutDiagram({ id, active }: { id: ContentLayout; active: boolean }) {
  const a = active ? 'bg-accent/40' : 'bg-fg-dim';
  return (
    <div className="w-full h-6 border border-border-subtle relative bg-bg">
      {id === 'single-pane' && <div className={`absolute inset-1 ${a} opacity-60`} />}
      {id === 'master-detail' && (
        <>
          <div className={`absolute top-1 bottom-1 left-1 w-[35%] ${a} opacity-70`} />
          <div className={`absolute top-1 bottom-1 right-1 left-[42%] ${a} opacity-40`} />
        </>
      )}
      {id === 'dashboard-first' && (
        <>
          <div className={`absolute top-1 left-1 right-1 h-[40%] ${a} opacity-70`} />
          <div className={`absolute bottom-1 left-1 right-1 top-[55%] ${a} opacity-40`} />
        </>
      )}
      {id === 'compact-list' && (
        <div className="absolute inset-1 flex flex-col gap-px">
          <div className={`h-px flex-1 ${a} opacity-60`} />
          <div className={`h-px flex-1 ${a} opacity-50`} />
          <div className={`h-px flex-1 ${a} opacity-40`} />
          <div className={`h-px flex-1 ${a} opacity-30`} />
        </div>
      )}
    </div>
  );
}

// ─── Density ──────────────────────────────────────────────────────────
function SectionDensity() {
  const d = usePrefsStore((s) => s.prefs.appearance.density);
  const setD = usePrefsStore((s) => s.setDensity);
  return (
    <Section
      icon={<Gauge className="w-3.5 h-3.5 text-fg-muted" />}
      label="Density"
      hint="row + padding scale"
    >
      <Segmented
        options={DENSITY_STOPS}
        value={d}
        onChange={(v) => setD(v as DensityStop)}
      />
    </Section>
  );
}

// ─── Motion ───────────────────────────────────────────────────────────
function SectionMotion() {
  const motion = usePrefsStore((s) => s.prefs.appearance.motion);
  const reduce = usePrefsStore((s) => s.prefs.appearance.reduceMotion);
  const setMotion = usePrefsStore((s) => s.setMotion);
  const setReduce = usePrefsStore((s) => s.setReduceMotion);
  return (
    <Section icon={<Wind className="w-3.5 h-3.5 text-fg-muted" />} label="Motion">
      <Segmented
        options={MOTION_STOPS}
        value={motion}
        onChange={(v) => setMotion(v as MotionStop)}
        disabled={reduce}
      />
      <label className="mt-3 flex items-center gap-2 text-[11px] cursor-pointer">
        <input
          type="checkbox"
          checked={reduce}
          onChange={(e) => setReduce(e.target.checked)}
          className="accent-current"
        />
        <span className="text-fg">Reduce motion</span>
        <span className="text-[10px] text-fg-subtle font-mono">
          (kills animations · respects macOS Reduce Motion)
        </span>
      </label>
    </Section>
  );
}

// ─── Live sync ────────────────────────────────────────────────────────
function SectionLiveSync() {
  const ls = usePrefsStore((s) => s.prefs.liveSync);
  const setEnabled = usePrefsStore((s) => s.setLiveSyncEnabled);
  const setInterval = usePrefsStore((s) => s.setLiveSyncInterval);
  const setAdaptive = usePrefsStore((s) => s.setLiveSyncAdaptive);
  const setAuto = usePrefsStore((s) => s.setLiveSyncAutoAction);
  const setNotif = usePrefsStore((s) => s.setLiveSyncNotification);

  return (
    <Section icon={<Activity className="w-3.5 h-3.5 text-fg-muted" />} label="Live sync">
      <div className="space-y-1">
        <IosToggle label="Live sync" checked={ls.enabled} onChange={setEnabled} />
        <div className="pt-2">
          <div className="text-[11px] text-fg-muted mb-1">Check for new emails</div>
          <Segmented
            options={[
              { id: '30', label: '30s' },
              { id: '60', label: '60s' },
              { id: '120', label: '2m' },
              { id: '300', label: '5m' },
            ]}
            value={String(ls.pollingIntervalActive)}
            onChange={(v) => setInterval(Number(v))}
            disabled={!ls.enabled}
          />
        </div>
        <IosToggle
          label="Adaptive intervals"
          checked={ls.adaptivePolling}
          onChange={setAdaptive}
        />
        <div className="text-[10px] font-mono uppercase text-fg-subtle tracking-wider pt-2 pb-1">
          Auto-actions
        </div>
        <IosToggle
          label="Apply existing rules"
          checked={ls.autoActions.applyExistingRules}
          onChange={(v) => setAuto('applyExistingRules', v)}
        />
        <IosToggle
          label="Block listed senders"
          checked={ls.autoActions.blockListedSenders}
          onChange={(v) => setAuto('blockListedSenders', v)}
        />
        <IosToggle
          label="Auto-archive newsletters"
          checked={ls.autoActions.autoArchiveNewsletters}
          onChange={(v) => setAuto('autoArchiveNewsletters', v)}
        />
        <IosToggle
          label="Auto-sort known senders"
          checked={ls.autoActions.autoSortKnownSenders}
          onChange={(v) => setAuto('autoSortKnownSenders', v)}
        />
        <div className="text-[10px] font-mono uppercase text-fg-subtle tracking-wider pt-2 pb-1">
          Notifications
        </div>
        <IosToggle
          label="Badge for new emails"
          checked={ls.notifications.showNewEmailBadge}
          onChange={(v) => setNotif('showNewEmailBadge', v)}
        />
        <IosToggle
          label="Ring bell for approvals"
          checked={ls.notifications.ringBellOnApprovals}
          onChange={(v) => setNotif('ringBellOnApprovals', v)}
        />
        <IosToggle
          label="Show approval popup on focus"
          checked={ls.notifications.autoShowModalOnFocus}
          onChange={(v) => setNotif('autoShowModalOnFocus', v)}
        />
      </div>
    </Section>
  );
}

// ─── Reset row ────────────────────────────────────────────────────────
function SectionReset() {
  const resetAll = usePrefsStore((s) => s.resetAll);
  const resetTheme = usePrefsStore((s) => s.resetThemeOnly);
  const openWizard = usePrefsStore((s) => s.openWizard);
  const closePanel = usePrefsStore((s) => s.setPanelOpen);
  return (
    <section className="px-4 py-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="ghost" onClick={resetTheme}>
          Reset theme
        </Button>
        <Button size="sm" variant="ghost" onClick={resetAll}>
          Reset all
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            closePanel(false);
            openWizard();
          }}
        >
          Back to wizard
        </Button>
      </div>
      <div className="mt-2 text-[10px] text-fg-subtle font-mono">
        Defaults · Midnight · Focused · Cyan · Left
      </div>
    </section>
  );
}

function SectionPanels() {
  const panels = usePrefsStore((s) => s.prefs.panels);
  const setPanel = usePrefsStore((s) => s.setPanel);
  return (
    <Section label="Visible panels">
      <div className="space-y-0.5">
        {PANEL_TOGGLES.map(({ key, label }) => (
          <IosToggle
            key={key}
            label={label}
            checked={panels[key]}
            onChange={(on) => setPanel(key, on)}
          />
        ))}
      </div>
    </Section>
  );
}

const SIDEBAR_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  suggestions: 'Suggestions',
  analyze: 'Analyze',
  senders: 'Senders',
  folders: 'Folders',
  rules: 'Rules',
  blocked: 'Blocked',
  settings: 'Settings',
};

function SectionSidebarItems() {
  const items = usePrefsStore((s) => s.prefs.layout.sidebarItems);
  const setItems = usePrefsStore((s) => s.setSidebarItems);
  const dragIdx = useRef<number | null>(null);

  const sorted = useMemo(
    () => [...items].sort((a, b) => a.order - b.order),
    [items]
  );

  const reorder = (from: number, to: number) => {
    if (from === to) return;
    const next = [...sorted];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setItems(next.map((item, i) => ({ ...item, order: i })));
  };

  return (
    <Section label="Sidebar items" hint="drag to reorder">
      <div className="space-y-px border border-border-subtle">
        {sorted.map((item, idx) => (
          <div
            key={item.id}
            draggable
            onDragStart={() => {
              dragIdx.current = idx;
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (dragIdx.current !== null) reorder(dragIdx.current, idx);
              dragIdx.current = null;
            }}
            className="flex items-center gap-2 px-2 py-1.5 bg-bg hover:bg-bg-hover cursor-grab active:cursor-grabbing"
          >
            <GripVertical className="w-3 h-3 text-fg-subtle shrink-0" />
            <span className="flex-1 text-[12px] text-fg truncate">
              {SIDEBAR_LABELS[item.id] ?? item.id}
            </span>
            <IosToggle
              label=""
              checked={item.visible}
              onChange={(on) => {
                setItems(
                  items.map((i) => (i.id === item.id ? { ...i, visible: on } : i))
                );
              }}
            />
          </div>
        ))}
      </div>
      <p className="text-[10px] text-fg-subtle font-mono mt-2">
        Hidden items stay reachable via keyboard shortcuts (1–8).
      </p>
    </Section>
  );
}

function SectionCustomCss() {
  const css = usePrefsStore((s) => s.prefs.appearance.customCss);
  const setCustomCss = usePrefsStore((s) => s.setCustomCss);
  const [open, setOpen] = useState(!!css);
  const [draft, setDraft] = useState(css);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setDraft(css), [css]);

  const onChange = (value: string) => {
    setDraft(value);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCustomCss(value), 300);
  };

  return (
    <Section icon={<Code2 className="w-3.5 h-3.5 text-fg-muted" />} label="Custom CSS">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-[11px] font-mono text-accent hover:underline mb-2"
      >
        {open ? 'Hide advanced' : 'Show advanced'}
      </button>
      {open && (
        <textarea
          value={draft}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
          placeholder={`/* Override any CSS variable or class */\n:root { --color-accent: 255 107 53; }\n.sidebar { width: 280px; }`}
          className="w-full h-[200px] font-mono text-[11px] bg-bg-inset border border-border p-2 text-fg resize-y"
        />
      )}
    </Section>
  );
}

// ─── Generic segmented control ────────────────────────────────────────
function Segmented<T extends string>({
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
