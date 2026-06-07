import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { Button } from '../ui/Button';
import { useUIStore } from '@/stores/uiStore';
import { SettingsCollapsibleSection } from './SettingsCollapsibleSection';

export function SettingsGeneral({ onSaved }: { onSaved?: () => void }) {
  const showToast = useUIStore((s) => s.showToast);
  const [deletionMode, setDeletionMode] = useState<'trash' | 'permanent'>('trash');
  const [maxFetch, setMaxFetch] = useState(5000);

  useEffect(() => {
    void window.mailvault.getSettings().then((s) => {
      setDeletionMode(s.deletionMode);
      setMaxFetch(s.maxFetchPerAccount);
    });
  }, []);

  const onSave = async () => {
    await window.mailvault.setSettings({ deletionMode, maxFetchPerAccount: maxFetch });
    showToast('ok', 'Settings saved');
    onSaved?.();
  };

  return (
    <>
      <SettingsCollapsibleSection
        id="general-deletion"
        title="Deletion behavior"
        subtitle="Choose whether deleted mail goes to Trash or is erased permanently."
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <ChoiceCard
            active={deletionMode === 'trash'}
            onClick={() => setDeletionMode('trash')}
            title="Move to Trash"
            desc="Recoverable. Provider auto-purges in ~30 days. Undo enabled."
          />
          <ChoiceCard
            active={deletionMode === 'permanent'}
            onClick={() => setDeletionMode('permanent')}
            danger
            title="Permanent delete"
            desc="Bypasses Trash. Cannot be recovered. No undo."
          />
        </div>
      </SettingsCollapsibleSection>

      <SettingsCollapsibleSection
        id="general-sync-limits"
        title="Sync limits"
        subtitle="Caps how much mail a full analysis can fetch at once."
      >
        <div>
          <label className="label-mono mb-1.5 block">Max messages per full sync</label>
          <input
            type="number"
            min={500}
            max={50000}
            step={500}
            value={maxFetch}
            onChange={(e) => setMaxFetch(Number(e.target.value))}
            className="input max-w-xs"
          />
          <p className="text-[10px] text-fg-subtle font-mono mt-1">
            Used on the Analyze page. Live sync polls the latest Inbox + Junk mail separately.
          </p>
        </div>
      </SettingsCollapsibleSection>

      <SettingsCollapsibleSection
        id="general-security"
        title="Security"
        subtitle="How MailVault stores credentials and talks to providers."
      >
        <ul className="text-[12px] space-y-1 text-fg-muted">
          <li>· OAuth tokens stored in the OS keychain</li>
          <li>· No backend — API calls go directly to Google / Microsoft</li>
          <li>· Renderer is sandboxed; only main process touches tokens</li>
        </ul>
      </SettingsCollapsibleSection>

      <div className="flex justify-end pt-1">
        <Button variant="primary" iconLeft={<Save className="w-3 h-3" />} onClick={onSave}>
          Save general settings
        </Button>
      </div>
    </>
  );
}

function ChoiceCard({
  active,
  danger,
  onClick,
  title,
  desc,
}: {
  active: boolean;
  danger?: boolean;
  onClick: () => void;
  title: string;
  desc: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`panel-inset p-3 text-left transition-colors ${
        active
          ? danger
            ? 'border-danger/50 bg-danger/[0.05]'
            : 'border-accent/50 bg-accent/[0.05]'
          : 'hover:border-border-strong'
      }`}
    >
      <div
        className={`text-[12px] font-medium mb-1 ${
          active ? (danger ? 'text-danger' : 'text-accent') : 'text-fg'
        }`}
      >
        {title}
      </div>
      <div className="text-[10px] text-fg-muted">{desc}</div>
    </button>
  );
}
