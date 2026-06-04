import { useEffect, useState } from 'react';
import { Sparkles, X } from 'lucide-react';

const ENTRIES: Array<{ version: string; date: string; items: string[] }> = [
  {
    version: '0.1.0',
    date: 'June 2026',
    items: [
      'Local MailVault accounts with bcrypt-hashed passwords (no cloud).',
      'OAuth2 + PKCE for Gmail (consumer Google) and Microsoft (consumers tenant).',
      'Multi-stage sync engine with live progress drawer and per-stage logs.',
      'Folder organization, sender grid, blocking, and rules engine.',
      'Universal macOS build (arm64 + x64) with hardened runtime entitlements.',
      'Onboarding tour. Re-launch from Help → Show Me Around or ⌘⇧?.',
    ],
  },
];

export function WhatsNewModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onShow = () => setOpen(true);
    window.addEventListener('mailvault:open-whats-new', onShow);
    return () => window.removeEventListener('mailvault:open-whats-new', onShow);
  }, []);

  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal
      className="fixed inset-0 z-[1015] flex items-center justify-center p-6 bg-black/65 backdrop-blur-[2px] animate-fade-in"
      onClick={() => setOpen(false)}
    >
      <div
        className="bg-bg-elevated border border-border w-[520px] max-w-full max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 h-10 border-b border-border-subtle">
          <div className="label-mono-strong flex items-center gap-2">
            <Sparkles className="w-3 h-3 text-accent" />
            What's New
          </div>
          <button
            onClick={() => setOpen(false)}
            className="text-fg-subtle hover:text-fg"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="p-5 space-y-5">
          {ENTRIES.map((e) => (
            <div key={e.version}>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="font-mono text-[14px] text-accent font-semibold">
                  v{e.version}
                </span>
                <span className="font-mono text-[10px] uppercase tracking-widest text-fg-subtle">
                  {e.date}
                </span>
              </div>
              <ul className="space-y-1.5">
                {e.items.map((item, i) => (
                  <li
                    key={i}
                    className="text-[12.5px] text-fg-muted leading-relaxed pl-3 relative before:absolute before:left-0 before:top-[8px] before:w-1.5 before:h-px before:bg-accent/60"
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
