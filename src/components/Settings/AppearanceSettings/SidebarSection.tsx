import clsx from 'clsx';
import { usePrefsStore } from '@/stores/prefsStore';
import { PANEL_TOGGLES, SIDEBAR_POSITIONS, IosToggle } from '@/components/Personalization/shared';
import type { PanelsPrefs, SidebarPosition } from '@shared/types';

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

export function SidebarSection() {
  const sidebar = usePrefsStore((s) => s.prefs.layout.sidebarPosition);
  const setSidebar = usePrefsStore((s) => s.setSidebarPosition);
  const panels = usePrefsStore((s) => s.prefs.panels);
  const setPanel = usePrefsStore((s) => s.setPanel);

  return (
    <div>
      <div className="panel p-4 space-y-3 max-w-lg mb-4">
        <div className="label-mono text-[10px]">Sidebar position</div>
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
                  : 'border-border-subtle text-fg-muted hover:text-fg'
              )}
            >
              <SidebarDiagram pos={p.id} active={sidebar === p.id} />
              <span className="font-mono">{p.label}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="panel p-4 max-w-lg space-y-1">
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
    </div>
  );
}
