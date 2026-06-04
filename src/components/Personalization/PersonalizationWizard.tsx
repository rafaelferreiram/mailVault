import { useCallback, useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { ArrowLeft, ArrowRight, Sparkles } from 'lucide-react';
import {
  DEFAULT_PREFS,
  type ContentLayout,
  type PanelsPrefs,
  type Preferences,
  type SidebarPosition,
  type StyleName,
  type ThemeName,
} from '@shared/types';
import { ThemeEngine, isValidHex } from '@/lib/themeEngine';
import { usePrefsStore } from '@/stores/prefsStore';
import { Button } from '@/components/ui/Button';
import { WizardMockPreview } from './WizardMockPreview';
import {
  ACCENT_PRESETS,
  CONTENT_LAYOUTS,
  IosToggle,
  PANEL_TOGGLES,
  SIDEBAR_POSITIONS,
  STYLES,
  StyleCardGrid,
  ThemeSwatchGrid,
  WizardDots,
} from './shared';

const TOTAL_STEPS = 5;

const THEME_DEFAULT_ACCENT: Record<ThemeName, string> = {
  midnight: '#00d4ff',
  arctic: '#0066cc',
  obsidian: '#bf5af2',
  linen: '#d97706',
  terminal: '#00e676',
  fog: '#475569',
};

export function PersonalizationWizard() {
  const open = usePrefsStore((s) => s.wizardOpen);
  const closeWizard = usePrefsStore((s) => s.closeWizard);
  const savedPrefs = usePrefsStore((s) => s.prefs);

  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<Preferences>(() => ({ ...DEFAULT_PREFS }));
  const [hoverTheme, setHoverTheme] = useState<ThemeName | null>(null);
  const [hoverStyleDesc, setHoverStyleDesc] = useState<string | null>(null);
  const [accentDraft, setAccentDraft] = useState(DEFAULT_PREFS.appearance.accent);

  // Reset draft when wizard opens.
  useEffect(() => {
    if (!open) return;
    setStep(1);
    setDraft({ ...savedPrefs });
    setAccentDraft(savedPrefs.appearance.accent);
    setHoverTheme(null);
  }, [open, savedPrefs]);

  // Paint wizard chrome + mock from draft (not persisted until finish).
  const applyDraft = useCallback((p: Preferences) => {
    ThemeEngine.applyAppearance(p.appearance);
    ThemeEngine.applyLayoutTemplate(p.layout.template ?? 'master-detail');
    ThemeEngine.applyEmailView(p.emailView);
  }, []);

  useEffect(() => {
    if (!open) return;
    applyDraft(draft);
  }, [open, draft, applyDraft]);

  const patchDraft = useCallback((fn: (cur: Preferences) => Preferences) => {
    setDraft((cur) => fn(cur));
  }, []);

  const finish = useCallback(() => {
    const final: Preferences = {
      ...draft,
      wizard: { completed: true, skipped: false, completedAt: Date.now() },
      updatedAt: Date.now(),
    };
    usePrefsStore.getState().commitPreferences(final);
    closeWizard();
  }, [draft, closeWizard]);

  const skip = useCallback(() => {
    ThemeEngine.clearAccentOverride();
    const fresh: Preferences = {
      ...DEFAULT_PREFS,
      wizard: { completed: true, skipped: true, completedAt: Date.now() },
      updatedAt: Date.now(),
    };
    usePrefsStore.getState().commitPreferences(fresh);
    closeWizard();
  }, [closeWizard]);

  const styleHint = useMemo(() => {
    if (hoverStyleDesc) return hoverStyleDesc;
    const cur = STYLES.find((s) => s.id === draft.appearance.style);
    return cur ? `${cur.label} — ${cur.desc}` : '';
  }, [hoverStyleDesc, draft.appearance.style]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex bg-bg text-fg">
      {/* Left: wizard content */}
      <div className="w-[40%] min-w-[360px] max-w-[520px] flex flex-col border-r border-border bg-bg-elevated">
        <div className="px-6 pt-6 pb-4 flex items-center justify-between">
          <WizardDots step={step} total={TOTAL_STEPS} />
          <button
            type="button"
            onClick={skip}
            className="text-[11px] font-mono text-fg-subtle hover:text-fg uppercase tracking-wider"
          >
            Skip — use defaults
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-4">
          {step === 1 && <StepWelcome onNext={() => setStep(2)} onSkip={skip} />}
          {step === 2 && (
            <StepTheme
              selected={draft.appearance.theme}
              onSelect={(theme) =>
                patchDraft((p) => ({
                  ...p,
                  appearance: {
                    ...p.appearance,
                    theme,
                    accent: THEME_DEFAULT_ACCENT[theme],
                  },
                }))
              }
              onHover={setHoverTheme}
            />
          )}
          {step === 3 && (
            <StepStyle
              selected={draft.appearance.style}
              hint={styleHint}
              onSelect={(style) => patchDraft((p) => ({ ...p, appearance: { ...p.appearance, style } }))}
              onHover={(s) => setHoverStyleDesc(s ? STYLES.find((x) => x.id === s)?.desc ?? null : null)}
            />
          )}
          {step === 4 && (
            <StepLayout
              draft={draft}
              onSidebar={(sidebarPosition) =>
                patchDraft((p) => ({ ...p, layout: { ...p.layout, sidebarPosition } }))
              }
              onContent={(contentLayout) =>
                patchDraft((p) => ({ ...p, layout: { ...p.layout, contentLayout } }))
              }
              onPanel={(key, on) =>
                patchDraft((p) => ({ ...p, panels: { ...p.panels, [key]: on } }))
              }
            />
          )}
          {step === 5 && (
            <StepAccent
              accent={draft.appearance.accent}
              accentDraft={accentDraft}
              onAccentDraft={setAccentDraft}
              onSelect={(hex) => {
                setAccentDraft(hex);
                patchDraft((p) => ({ ...p, appearance: { ...p.appearance, accent: hex } }));
              }}
            />
          )}
        </div>

        {step > 1 && (
          <div className="px-6 py-4 border-t border-border flex items-center justify-between gap-3">
            <Button
              variant="ghost"
              size="sm"
              iconLeft={<ArrowLeft className="w-3.5 h-3.5" />}
              onClick={() => setStep((s) => Math.max(1, s - 1))}
            >
              Back
            </Button>
            {step < TOTAL_STEPS ? (
              <Button
                variant="primary"
                size="sm"
                iconRight={<ArrowRight className="w-3.5 h-3.5" />}
                onClick={() => setStep((s) => Math.min(TOTAL_STEPS, s + 1))}
              >
                {step === 2 ? 'Next: Style' : step === 3 ? 'Next: Layout' : 'Next: Accent'}
              </Button>
            ) : (
              <Button variant="primary" size="sm" onClick={finish}>
                Finish setup
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Right: live mock preview */}
      <div className="flex-1 flex flex-col min-w-0 bg-bg-inset p-6">
        <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-fg-subtle mb-3">
          Live preview
        </div>
        <div className="flex-1 min-h-0 rounded-sm overflow-hidden shadow-[0_0_0_1px_rgb(var(--color-border))]">
          <WizardMockPreview prefs={draft} previewTheme={hoverTheme} />
        </div>
        {step === 5 && (
          <p className="mt-4 text-center text-sm text-fg-muted">
            This is your MailVault. Ready to connect your email accounts?
          </p>
        )}
      </div>
    </div>
  );
}

function StepWelcome({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
  return (
    <div className="pt-8">
      <Sparkles className="w-8 h-8 text-accent mb-4" />
      <h1 className="text-xl font-medium tracking-tight text-fg mb-2">
        Make it yours before you start.
      </h1>
      <p className="text-sm text-fg-muted leading-relaxed mb-8 max-w-sm">
        MailVault works better when it feels like yours. Takes about 60 seconds. You can change
        everything later from Settings or <span className="font-mono text-fg">⌘,</span>.
      </p>
      <div className="flex flex-col gap-2 max-w-xs">
        <Button variant="primary" onClick={onNext}>
          Let&apos;s set it up
        </Button>
        <Button variant="ghost" onClick={onSkip}>
          Skip — use defaults
        </Button>
      </div>
    </div>
  );
}

function StepTheme({
  selected,
  onSelect,
  onHover,
}: {
  selected: ThemeName;
  onSelect: (t: ThemeName) => void;
  onHover: (t: ThemeName | null) => void;
}) {
  return (
    <div>
      <h2 className="text-lg font-medium mb-1">Pick a base theme</h2>
      <p className="text-sm text-fg-muted mb-4">Hover to preview · click to select</p>
      <ThemeSwatchGrid selected={selected} onSelect={onSelect} onHover={onHover} size="lg" />
    </div>
  );
}

function StepStyle({
  selected,
  hint,
  onSelect,
  onHover,
}: {
  selected: StyleName;
  hint: string;
  onSelect: (s: StyleName) => void;
  onHover: (s: StyleName | null) => void;
}) {
  return (
    <div>
      <h2 className="text-lg font-medium mb-1">How do you like your workspace?</h2>
      <p className="text-sm text-fg-muted mb-4 min-h-[20px]">{hint}</p>
      <StyleCardGrid selected={selected} onSelect={onSelect} onHover={onHover} />
    </div>
  );
}

function StepLayout({
  draft,
  onSidebar,
  onContent,
  onPanel,
}: {
  draft: Preferences;
  onSidebar: (p: SidebarPosition) => void;
  onContent: (l: ContentLayout) => void;
  onPanel: (key: keyof PanelsPrefs, on: boolean) => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-medium mb-1">Arrange your workspace</h2>
        <p className="text-sm text-fg-muted mb-4">Sidebar position + content layout</p>
      </div>

      <div>
        <div className="label-mono mb-2">Sidebar position</div>
        <div className="grid grid-cols-3 gap-1.5">
          {SIDEBAR_POSITIONS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onSidebar(p.id)}
              className={clsx(
                'py-2 px-1 border text-center transition-colors',
                draft.layout.sidebarPosition === p.id
                  ? 'border-accent bg-accent/5'
                  : 'border-border-subtle hover:border-border-strong'
              )}
            >
              <LayoutDiagram sidebar={p.id} />
              <div className="text-[10px] font-mono mt-1">{p.label}</div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="label-mono mb-2">Main content</div>
        <div className="grid grid-cols-2 gap-1.5">
          {CONTENT_LAYOUTS.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => onContent(l.id)}
              className={clsx(
                'py-2 px-2 border text-left transition-colors',
                draft.layout.contentLayout === l.id
                  ? 'border-accent bg-accent/5'
                  : 'border-border-subtle hover:border-border-strong'
              )}
            >
              <div className="text-[10px] font-mono">{l.label}</div>
              <div className="text-[9px] text-fg-subtle">{l.sub}</div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="label-mono mb-2">Visible panels</div>
        <div className="space-y-0.5">
          {PANEL_TOGGLES.map(({ key, label }) => (
            <IosToggle
              key={key}
              label={label}
              checked={draft.panels[key]}
              onChange={(on) => onPanel(key, on)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function StepAccent({
  accent,
  accentDraft,
  onAccentDraft,
  onSelect,
}: {
  accent: string;
  accentDraft: string;
  onAccentDraft: (v: string) => void;
  onSelect: (hex: string) => void;
}) {
  const valid = isValidHex(accentDraft);
  return (
    <div>
      <h2 className="text-lg font-medium mb-1">One last touch — your accent color</h2>
      <p className="text-sm text-fg-muted mb-4">
        Used for highlights, buttons, active states, and progress bars.
      </p>
      <div className="grid grid-cols-4 gap-2 mb-4">
        {ACCENT_PRESETS.map((p) => (
          <button
            key={p.hex}
            type="button"
            onClick={() => onSelect(p.hex)}
            className={clsx(
              'h-10 border transition-transform flex flex-col items-center justify-end pb-1',
              accent.toLowerCase() === p.hex.toLowerCase()
                ? 'border-fg scale-105'
                : 'border-border-subtle hover:border-border-strong'
            )}
            style={{ background: p.hex }}
            title={p.label}
          >
            <span className="text-[8px] font-mono text-bg/90 drop-shadow">{p.label}</span>
          </button>
        ))}
      </div>
      <label className="flex items-center gap-2 text-[11px]">
        <span className="font-mono uppercase tracking-wider text-fg-muted">Custom</span>
        <input
          type="text"
          value={accentDraft}
          onChange={(e) => {
            onAccentDraft(e.target.value);
            if (isValidHex(e.target.value)) onSelect(e.target.value);
          }}
          placeholder="#00d4ff"
          spellCheck={false}
          className={clsx(
            'flex-1 input h-8 font-mono text-[11px]',
            !valid && accentDraft && 'border-danger/50'
          )}
        />
      </label>
    </div>
  );
}

function LayoutDiagram({ sidebar }: { sidebar: SidebarPosition }) {
  return (
    <div className="mx-auto w-14 h-9 border border-border bg-bg relative">
      {sidebar === 'left' && <div className="absolute inset-y-0 left-0 w-3 bg-accent/40" />}
      {sidebar === 'right' && <div className="absolute inset-y-0 right-0 w-3 bg-accent/40" />}
      {sidebar === 'compact' && <div className="absolute inset-y-0 left-0 w-1 bg-accent/40" />}
    </div>
  );
}
