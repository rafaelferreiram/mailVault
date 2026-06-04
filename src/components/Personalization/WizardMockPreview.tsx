import clsx from 'clsx';
import type { ContentLayout, PanelsPrefs, Preferences, SidebarPosition, ThemeName } from '@shared/types';
import { formatBytes, formatNumber } from '@/lib/format';

// Live mock of the MailVault shell used in the setup wizard's right panel.
// All visual tokens come from data-* attributes on this subtree so hovering a
// theme swatch on the left can preview without touching the wizard chrome.

interface Props {
  prefs: Preferences;
  /** Hover preview — overrides theme on the mock only. */
  previewTheme?: ThemeName | null;
}

export function WizardMockPreview({ prefs, previewTheme }: Props) {
  const { appearance, layout, panels } = prefs;
  const theme = previewTheme ?? appearance.theme;

  return (
    <div
      data-theme={theme}
      data-style={appearance.style}
      data-density={appearance.density}
      data-sidebar={layout.sidebarPosition}
      data-layout={layout.contentLayout}
      className="h-full w-full flex flex-col overflow-hidden border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg))] text-[rgb(var(--color-fg))]"
      style={
        appearance.accent
          ? ({
              '--color-accent': hexToTriplet(appearance.accent),
            } as React.CSSProperties)
          : undefined
      }
    >
      {/* Top bar mock */}
      {panels.accountTabs && (
        <div className="h-7 shrink-0 border-b border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] flex items-center px-2 gap-2">
          <div className="w-16 h-3 bg-[rgb(var(--color-accent)/0.15)] border border-[rgb(var(--color-accent)/0.3)]" />
          <div className="flex gap-1">
            <TabMock active />
            <TabMock />
          </div>
        </div>
      )}

      <div
        className={clsx(
          'flex-1 flex min-h-0',
          layout.sidebarPosition === 'right' && 'flex-row-reverse'
        )}
      >
        {/* Sidebar mock */}
        <div
          className={clsx(
            'shrink-0 border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] flex flex-col',
            layout.sidebarPosition === 'compact' ? 'w-8 border-r' : 'w-[22%] border-r',
            layout.sidebarPosition === 'right' && 'border-r-0 border-l'
          )}
        >
          <div className="p-1 space-y-px flex-1">
            {visibleNavItems(layout, panels).map((item, i) => (
              <div
                key={item.id}
                className={clsx(
                  'flex items-center gap-1 px-1 border-l-2',
                  i === 2
                    ? 'border-l-[rgb(var(--color-accent))] bg-[rgb(var(--color-accent)/0.1)]'
                    : 'border-l-transparent'
                )}
                style={{ height: 'var(--sidebar-item-h, 28px)' }}
              >
                <div className="w-2 h-2 bg-[rgb(var(--color-fg-muted))]" />
                {layout.sidebarPosition !== 'compact' && (
                  <div className="h-1 flex-1 bg-[rgb(var(--color-fg-muted)/0.35)]" />
                )}
                {panels.emailBadges && layout.sidebarPosition !== 'compact' && (
                  <div className="w-2 h-1.5 bg-[rgb(var(--color-fg-dim))]" />
                )}
              </div>
            ))}
          </div>
          {panels.storageBar && (
            <div className="px-1 py-1 border-t border-[rgb(var(--color-border-subtle))]">
              <div className="h-1 bg-[rgb(var(--color-bg-hover))]">
                <div className="h-full w-2/3 bg-[rgb(var(--color-accent))]" />
              </div>
            </div>
          )}
        </div>

        {/* Main content mock */}
        <div className="flex-1 flex flex-col min-w-0 p-2 gap-2">
          {panels.welcomeGreeting && (
            <div className="h-2 w-1/3 bg-[rgb(var(--color-fg-muted)/0.4)]" />
          )}

          {panels.statsCards && layout.contentLayout === 'dashboard-first' && (
            <div className="grid grid-cols-4 gap-1">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-8 border border-[rgb(var(--color-border-subtle))] bg-[rgb(var(--color-bg-elevated))] p-1"
                >
                  <div className="h-1 w-2/3 bg-[rgb(var(--color-accent)/0.5)]" />
                  <div className="h-1 w-1/2 bg-[rgb(var(--color-fg-dim))] mt-1" />
                </div>
              ))}
            </div>
          )}

          <ContentMock layout={layout.contentLayout} panels={panels} accent={appearance.accent} />

          {panels.keyboardHints && (
            <div className="text-[8px] font-mono text-[rgb(var(--color-fg-subtle))] mt-auto">
              <span className="border border-[rgb(var(--color-border))] px-0.5">?</span> shortcuts
            </div>
          )}
        </div>

        {panels.suggestionFeed && (
          <div className="w-[24%] shrink-0 border-l border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] p-1 hidden xl:block">
            <div className="label-mono text-[7px] mb-1 opacity-60">Suggestions</div>
            {[0, 1].map((i) => (
              <div
                key={i}
                className="mb-1 p-1 border border-[rgb(var(--color-border-subtle))] bg-[rgb(var(--color-bg))]"
              >
                <div className="h-1 w-full bg-[rgb(var(--color-fg-dim))] mb-0.5" />
                <div className="h-1 w-2/3 bg-[rgb(var(--color-fg-dim)/0.5)]" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sync drawer mock */}
      {panels.syncDrawer && (
        <div className="h-5 shrink-0 border-t border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] flex items-center px-2 gap-2">
          <div className="h-1 flex-1 bg-[rgb(var(--color-bg-hover))]">
            <div className="h-full w-1/2 bg-[rgb(var(--color-accent))]" />
          </div>
          <span className="text-[7px] font-mono text-[rgb(var(--color-fg-subtle))]">SYNC</span>
        </div>
      )}
    </div>
  );
}

function TabMock({ active }: { active?: boolean }) {
  return (
    <div
      className={clsx(
        'h-4 px-2 flex items-center border-b',
        active
          ? 'border-[rgb(var(--color-accent))] bg-[rgb(var(--color-bg))]'
          : 'border-transparent opacity-50'
      )}
    >
      <div className="w-6 h-1 bg-[rgb(var(--color-fg-muted))]" />
    </div>
  );
}

function ContentMock({
  layout,
  panels,
  accent,
}: {
  layout: ContentLayout;
  panels: PanelsPrefs;
  accent: string;
}) {
  const rows = layout === 'compact-list' ? 8 : 5;
  const rowH = layout === 'compact-list' ? 14 : 22;

  if (layout === 'master-detail') {
    return (
      <div className="flex-1 flex gap-1 min-h-0">
        <div className="w-[38%] border border-[rgb(var(--color-border-subtle))] flex flex-col gap-px p-0.5">
          {Array.from({ length: rows }).map((_, i) => (
            <SenderRowMock key={i} height={rowH} selected={i === 1} accent={accent} />
          ))}
        </div>
        <div className="flex-1 border border-[rgb(var(--color-border-subtle))] p-2">
          <div className="h-2 w-1/2 bg-[rgb(var(--color-fg-muted)/0.4)] mb-2" />
          <div className="space-y-1">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-1 w-full bg-[rgb(var(--color-fg-dim))]" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 border border-[rgb(var(--color-border-subtle))] flex flex-col gap-px p-0.5 min-h-0 overflow-hidden">
      <div className="flex items-center justify-between px-1 py-0.5 border-b border-[rgb(var(--color-border-subtle))]">
        <span className="text-[7px] font-mono uppercase text-[rgb(var(--color-fg-subtle))]">
          Senders
        </span>
        <span className="text-[7px] font-mono text-[rgb(var(--color-accent))]">
          {formatNumber(1247)} · {formatBytes(2_400_000_000)}
        </span>
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <SenderRowMock key={i} height={rowH} selected={i === 2} accent={accent} />
      ))}
    </div>
  );
}

function SenderRowMock({
  height,
  selected,
  accent,
}: {
  height: number;
  selected?: boolean;
  accent: string;
}) {
  return (
    <div
      className={clsx(
        'flex items-center gap-1 px-1 border-l-2',
        selected
          ? 'border-l-[rgb(var(--color-accent))] bg-[rgb(var(--color-accent)/0.08)]'
          : 'border-l-transparent'
      )}
      style={{ height }}
    >
      <div className="w-2 h-2 rounded-full bg-[rgb(var(--color-fg-dim))]" />
      <div className="flex-1 h-1 bg-[rgb(var(--color-fg-muted)/0.35)]" />
      <div className="w-4 h-1 bg-[rgb(var(--color-fg-dim))]" />
    </div>
  );
}

function visibleNavItems(layout: Preferences['layout'], panels: PanelsPrefs) {
  return layout.sidebarItems
    .filter((i) => i.visible)
    .sort((a, b) => a.order - b.order)
    .slice(0, layout.sidebarPosition === 'compact' ? 6 : 5);
}

function hexToTriplet(hex: string): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return '0 212 255';
  const h = m[1];
  return `${parseInt(h.slice(0, 2), 16)} ${parseInt(h.slice(2, 4), 16)} ${parseInt(h.slice(4, 6), 16)}`;
}
