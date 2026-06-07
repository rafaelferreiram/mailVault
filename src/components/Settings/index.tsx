import { useState } from 'react';
import clsx from 'clsx';
import { UserCircle, Settings2, Radio, Palette, Mail, LifeBuoy } from 'lucide-react';
import { PageHeader } from '../PageHeader';
import { Icon } from '../ui/Icon';
import { SettingsGeneral } from './SettingsGeneral';
import { SettingsLiveSync } from './SettingsLiveSync';
import { AppearanceSettings } from './AppearanceSettings';
import { SettingsAccounts } from './SettingsAccounts';
import { SettingsProfile } from './SettingsProfile';
import { SettingsHelp } from './SettingsHelp';
import { SettingsSearchBar } from './SettingsSearchBar';
import { SettingsUiProvider } from './SettingsUiContext';
import type { SettingsTab } from './settingsSearchIndex';
import './settings.css';

export type { SettingsTab };

const TABS: Array<{ id: SettingsTab; label: string; icon: typeof Settings2 }> = [
  { id: 'profile', label: 'Profile', icon: UserCircle },
  { id: 'accounts', label: 'Email accounts', icon: Mail },
  { id: 'general', label: 'General', icon: Settings2 },
  { id: 'live-sync', label: 'Live sync', icon: Radio },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'help', label: 'Help', icon: LifeBuoy },
];

function SettingsBody({ tab }: { tab: SettingsTab }) {
  const [saveHint, setSaveHint] = useState<string | null>(null);

  if (tab === 'appearance') {
    return <AppearanceSettings />;
  }

  return (
    <div className="page-content">
      <div className="settings-stack">
        {tab === 'profile' && <SettingsProfile />}
        {tab === 'accounts' && <SettingsAccounts />}
        {tab === 'general' && <SettingsGeneral onSaved={() => setSaveHint('Saved')} />}
        {tab === 'live-sync' && <SettingsLiveSync />}
        {tab === 'help' && <SettingsHelp />}
        {saveHint && tab === 'general' && (
          <p className="text-[11px] font-mono text-ok">{saveHint}</p>
        )}
      </div>
    </div>
  );
}

export function Settings() {
  const [tab, setTab] = useState<SettingsTab>('profile');

  return (
    <SettingsUiProvider activeTab={tab} setActiveTab={setTab}>
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <PageHeader
          title="Settings"
          subtitle="Profile, email accounts, sync, appearance, and preferences"
        />

        <div className="settings-toolbar">
          <SettingsSearchBar />
        </div>

        <div className="flex-1 settings-shell min-h-0">
          <nav className="settings-nav">
            {TABS.map((t) => {
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={clsx(
                    'settings-nav__item w-full flex items-center gap-2.5 px-2.5 h-9 text-left text-[12px] border-l-2 transition-colors mb-px shrink-0',
                    active
                      ? 'settings-nav__item--active bg-accent/10 text-accent border-l-accent'
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
            <SettingsBody tab={tab} />
          </div>
        </div>
      </div>
    </SettingsUiProvider>
  );
}
