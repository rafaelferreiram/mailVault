import { useEffect } from 'react';
import { X } from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';
import { SHORTCUT_GROUPS } from '@/lib/shortcuts';

export function ShortcutsOverlay() {
  const open = useUIStore((s) => s.shortcutsOpen);
  const setOpen = useUIStore((s) => s.setShortcutsOpen);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === '?') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, setOpen]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 animate-fade-in pt-[10vh]"
      onClick={() => setOpen(false)}
    >
      <div
        className="panel w-full max-w-3xl mx-4 flex flex-col max-h-[80vh] animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 h-10 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-fg">
              Keyboard Shortcuts
            </div>
            <span className="text-[10px] font-mono text-fg-subtle">
              press <span className="kbd">?</span> any time
            </span>
          </div>
          <button onClick={() => setOpen(false)} className="text-fg-subtle hover:text-fg">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-y-auto p-5 grid grid-cols-2 gap-x-8 gap-y-5">
          {SHORTCUT_GROUPS.map((section) => (
            <div key={section.title}>
              <div className="label-mono mb-2">{section.title}</div>
              <div className="space-y-1.5">
                {section.rows.map((r, i) => (
                  <div key={i} className="flex items-center justify-between gap-3">
                    <span className="text-[12px] text-fg-muted">{r.label}</span>
                    <span className="flex gap-1">
                      {r.keys.map((k, j) => (
                        <span key={j} className="kbd">
                          {k}
                        </span>
                      ))}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
