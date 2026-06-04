import { useState } from 'react';
import clsx from 'clsx';
import { Settings2, Radio, Palette, Users, LifeBuoy } from 'lucide-react';
import { PageHeader } from '../PageHeader';
import { Icon } from '../ui/Icon';
import { SettingsGeneral } from './SettingsGeneral';
import { SettingsLiveSync } from './SettingsLiveSync';
import { AppearanceSettings } from './AppearanceSettings';
import { SettingsAccounts } from './SettingsAccounts';
import { SettingsHelp } from './SettingsHelp';

export type SettingsTab = 'general' | 'live-sync' | 'appearance' | 'accounts' | 'help';

const TABS: Array<{ id: SettingsTab; label: string; icon: typeof Settings2 }> = [
  { id: 'general', label: 'General', icon: Settings2 },
  { id: 'live-sync', label: 'Live sync', icon: Radio },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'accounts', label: 'Accounts', icon: Users },
  { id: 'help', label: 'Help', icon: LifeBuoy },
];

export function Settings() {
  const [tab, setTab] = useState<SettingsTab>('general');
  const [saveHint, setSaveHint] = useState<string | null>(null);

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <PageHeader
        title="Settings"
        subtitle="Configure MailVault — sync, appearance, accounts, and preferences"
      />

      <div className="flex-1 flex min-h-0">
        <nav className="w-[200px] shrink-0 border-r border-border bg-bg-elevated p-2 overflow-y-auto">
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={clsx(
                  'w-full flex items-center gap-2.5 px-2.5 h-9 text-left text-[12px] border-l-2 transition-colors mb-px',
                  active
                    ? 'bg-accent/10 text-accent border-l-accent'
                    : 'text-fg-muted hover:text-fg hover:bg-bg-hover border-l-transparent'
                )}
              >
                <Icon icon={t.icon} size="sm" active={active} />
                {t.label}
              </button>
            );
          })}
        </nav>

        <div className="flex-1 overflow-y-auto min-w-0 flex flex-col min-h-0">
          {tab === 'appearance' ? (
            <AppearanceSettings />
          ) : (
            <div className="p-6 max-w-3xl space-y-4">
              {tab === 'general' && <SettingsGeneral onSaved={() => setSaveHint('Saved')} />}
              {tab === 'live-sync' && <SettingsLiveSync />}
              {tab === 'accounts' && <SettingsAccounts />}
              {tab === 'help' && <SettingsHelp />}
              {saveHint && tab === 'general' && (
                <p className="text-[11px] font-mono text-ok">{saveHint}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
