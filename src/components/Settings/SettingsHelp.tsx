import { Compass, Keyboard, Palette, Sparkles, MessageSquare } from 'lucide-react';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { useUIStore } from '@/stores/uiStore';
import { usePrefsStore } from '@/stores/prefsStore';
import { Icon } from '../ui/Icon';
import { SettingsCollapsibleSection } from './SettingsCollapsibleSection';

export function SettingsHelp() {
  const openTour = useOnboardingStore((s) => s.openManual);
  const setShortcutsOpen = useUIStore((s) => s.setShortcutsOpen);
  const openPrefs = usePrefsStore((s) => s.setPanelOpen);

  const items = [
    {
      icon: Compass,
      title: 'Restart onboarding tour',
      desc: 'Walk through MailVault features step by step.',
      kbd: '⌘⇧?',
      onClick: () => openTour(),
    },
    {
      icon: Keyboard,
      title: 'Keyboard shortcuts',
      desc: 'View all navigation and action keys.',
      kbd: '?',
      onClick: () => setShortcutsOpen(true),
    },
    {
      icon: Sparkles,
      title: "What's new",
      desc: 'See the latest MailVault updates.',
      onClick: () => window.dispatchEvent(new CustomEvent('mailvault:open-whats-new')),
    },
    {
      icon: Palette,
      title: 'Advanced personalization',
      desc: 'Open the full appearance panel with custom CSS.',
      kbd: '⌘,',
      onClick: () => openPrefs(true),
    },
    {
      icon: MessageSquare,
      title: 'Send feedback',
      desc: 'Report a problem or suggest an improvement.',
      onClick: () =>
        window.open('mailto:hi@mailvault.app?subject=MailVault%20feedback', '_blank'),
    },
  ];

  return (
    <SettingsCollapsibleSection
      id="help-actions"
      title="Help & resources"
      subtitle="Tours, shortcuts, updates, and feedback."
    >
      <div className="panel divide-y divide-border-subtle -mx-0">
        {items.map((item) => (
          <button
            key={item.title}
            type="button"
            onClick={item.onClick}
            className="w-full flex items-start gap-3 p-4 text-left hover:bg-bg-hover transition-colors"
          >
            <Icon icon={item.icon} size="sm" className="text-fg-muted mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-[13px] text-fg">{item.title}</div>
              <div className="text-[11px] text-fg-muted mt-0.5">{item.desc}</div>
            </div>
            {item.kbd && (
              <span className="font-mono text-[10px] text-fg-subtle shrink-0">{item.kbd}</span>
            )}
          </button>
        ))}
      </div>
    </SettingsCollapsibleSection>
  );
}
