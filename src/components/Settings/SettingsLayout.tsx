import clsx from 'clsx';
import { usePrefsStore } from '@/stores/prefsStore';
import {
  SIDEBAR_POSITIONS,
  CONTENT_LAYOUTS,
  PANEL_TOGGLES,
  IosToggle,
} from '@/components/Personalization/shared';
import type { ContentLayout, PanelsPrefs, SidebarPosition } from '@shared/types';

export function SettingsLayout() {
  const sidebar = usePrefsStore((s) => s.prefs.layout.sidebarPosition);
  const layout = usePrefsStore((s) => s.prefs.layout.contentLayout);
  const panels = usePrefsStore((s) => s.prefs.panels);
  const setSidebar = usePrefsStore((s) => s.setSidebarPosition);
  const setLayout = usePrefsStore((s) => s.setContentLayout);
  const setPanel = usePrefsStore((s) => s.setPanel);

  return (
    <>
      <div className="panel p-4 space-y-3">
        <div className="label-mono">Sidebar position</div>
        <div className="grid grid-cols-3 gap-2">
          {SIDEBAR_POSITIONS.map((p) => (
            <button
              key={p.id}
              type="button"
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
      </div>

      <div className="panel p-4 space-y-3">
        <div className="label-mono">Content layout</div>
        <div className="grid grid-cols-2 gap-2">
          {CONTENT_LAYOUTS.map((l) => (
            <button
              key={l.id}
              type="button"
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
      </div>

      <div className="panel p-4 space-y-1">
        <div className="label-mono mb-2">Visible panels</div>
        {PANEL_TOGGLES.map(({ key, label }) => (
          <IosToggle
            key={key}
            label={label}
            checked={panels[key]}
            onChange={(v) => setPanel(key as keyof PanelsPrefs, v)}
          />
        ))}
      </div>
    </>
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
