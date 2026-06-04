import { useState, useEffect, useRef } from 'react';
import { HelpCircle, MessageSquare, Keyboard, Sparkles, Compass, Palette } from 'lucide-react';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { useUIStore } from '@/stores/uiStore';
import { usePrefsStore } from '@/stores/prefsStore';
import { Icon } from '@/components/ui/Icon';

export function HelpPopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const openOnboardingManual = useOnboardingStore((s) => s.openManual);
  const setShortcutsOpen = useUIStore((s) => s.setShortcutsOpen);
  const openPrefs = usePrefsStore((s) => s.setPanelOpen);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('mousedown', onClick);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onClick);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const items: Array<{ icon: typeof Compass; label: string; kbd?: string; onClick: () => void }> = [
    {
      icon: Palette,
      label: 'Change appearance',
      kbd: '⌘,',
      onClick: () => {
        setOpen(false);
        openPrefs(true);
      },
    },
    {
      icon: Compass,
      label: 'Restart tour',
      kbd: '⌘⇧?',
      onClick: () => {
        setOpen(false);
        openOnboardingManual();
      },
    },
    {
      icon: Keyboard,
      label: 'Keyboard shortcuts',
      kbd: '?',
      onClick: () => {
        setOpen(false);
        setShortcutsOpen(true);
      },
    },
    {
      icon: Sparkles,
      label: "What's New",
      onClick: () => {
        setOpen(false);
        window.dispatchEvent(new CustomEvent('mailvault:open-whats-new'));
      },
    },
    {
      icon: MessageSquare,
      label: 'Report a problem',
      onClick: () => {
        setOpen(false);
        window.open('mailto:hi@mailvault.app?subject=MailVault%20feedback', '_blank');
      },
    },
  ];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-2 h-7 text-[12px] text-fg-muted hover:text-fg hover:bg-bg-hover border-l-2 border-l-transparent"
        title="Help & support"
      >
        <span className="flex items-center gap-2.5">
          <Icon icon={HelpCircle} size="sm" />
          Help
        </span>
        {open && <span className="kbd">▴</span>}
      </button>
      {open && (
        <div className="absolute left-0 right-0 bottom-full mb-1 bg-bg-elevated border border-border shadow-[0_8px_24px_rgba(0,0,0,0.5)] z-30 animate-fade-in">
          {items.map((it) => {
            const MenuIcon = it.icon;
            return (
              <button
                key={it.label}
                onClick={it.onClick}
                className="w-full flex items-center justify-between px-3 h-8 text-[12px] text-fg-muted hover:text-accent hover:bg-bg-hover"
              >
                <span className="flex items-center gap-2.5">
                  <Icon icon={MenuIcon} size="sm" />
                  {it.label}
                </span>
                {it.kbd && <span className="kbd">{it.kbd}</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
