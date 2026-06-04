import clsx from 'clsx';
import { Loader2, Radio, RefreshCw } from 'lucide-react';
import { useLiveSyncStore } from '@/stores/liveSyncStore';
import { useLiveStatus } from '@/hooks/useLiveSync';
import { usePrefsStore } from '@/stores/prefsStore';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { IosToggle } from '@/components/ui/Switch';

function relTime(ts: number | null | undefined): string {
  if (!ts) return '—';
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  return `${Math.floor(s / 60)}m ago`;
}

function nextIn(ts: number | null | undefined): string {
  if (!ts) return '—';
  const s = Math.max(0, Math.floor((ts - Date.now()) / 1000));
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m`;
}

interface LiveSyncControlProps {
  /** Compact row for Analyze action bar; full card elsewhere. */
  variant?: 'card' | 'inline';
  showFolderNote?: boolean;
}

export function LiveSyncControl({ variant = 'card', showFolderNote = true }: LiveSyncControlProps) {
  const livePrefs = usePrefsStore((s) => s.prefs.liveSync);
  const setEnabled = usePrefsStore((s) => s.setLiveSyncEnabled);
  const setInterval = usePrefsStore((s) => s.setLiveSyncInterval);
  const setAdaptive = usePrefsStore((s) => s.setLiveSyncAdaptive);
  const setAuto = usePrefsStore((s) => s.setLiveSyncAutoAction);
  const setNotif = usePrefsStore((s) => s.setLiveSyncNotification);

  const status = useLiveStatus();
  const checkNow = useLiveSyncStore((s) => s.checkNow);
  const pauseSync = useLiveSyncStore((s) => s.pauseSync);
  const resumeSync = useLiveSyncStore((s) => s.resumeSync);

  const enabled = livePrefs.enabled && (status?.enabled ?? false);
  const accounts = status?.accounts ?? [];
  const primary = accounts[0];
  const anyPolling = accounts.some((a) => a.status === 'polling');

  const onToggle = (on: boolean) => {
    void setEnabled(on);
  };

  const inner = (
    <>
      <div className={clsx('flex items-start justify-between gap-4', variant === 'inline' && 'flex-wrap')}>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {anyPolling ? (
              <Icon icon={Loader2} size="sm" spin className="text-accent" />
            ) : enabled ? (
              <Icon icon={Radio} size="sm" className="text-ok" />
            ) : (
              <Icon icon={Radio} size="sm" className="text-fg-subtle" />
            )}
            <span className="text-[13px] font-medium text-fg">Live sync</span>
            {enabled && (
              <span className="px-1.5 h-[18px] inline-flex items-center bg-ok/10 border border-ok/30 text-ok font-mono text-[9px] uppercase tracking-widest">
                Watching
              </span>
            )}
          </div>
          <p className="text-[11px] text-fg-muted mt-1 leading-relaxed max-w-xl">
            {enabled
              ? 'Polling Inbox and Junk for new mail, applying rules and surfacing approvals automatically.'
              : 'Turn on to keep watching for new Inbox and Junk mail after your initial sync.'}
          </p>
          {showFolderNote && (
            <p className="text-[10px] font-mono text-fg-subtle mt-1.5 uppercase tracking-wider">
              Folders: Inbox + Junk/Spam · All linked accounts
            </p>
          )}
          {enabled && primary && (
            <p className="text-[10px] font-mono text-fg-subtle mt-1">
              Last check {relTime(primary.lastPollAt)} · Next in {nextIn(primary.nextPollAt)}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {enabled && (
            <>
              <Button variant="ghost" size="xs" onClick={() => void checkNow()}>
                <Icon icon={RefreshCw} size="xs" className="mr-1" />
                Check now
              </Button>
              <Button
                variant="ghost"
                size="xs"
                onClick={() => void (anyPolling ? pauseSync() : resumeSync())}
              >
                {anyPolling ? 'Pause' : 'Resume'}
              </Button>
            </>
          )}
          <IosToggle checked={livePrefs.enabled} onChange={onToggle} />
        </div>
      </div>

      {variant === 'card' && livePrefs.enabled && (
        <div className="mt-4 pt-4 border-t border-border-subtle space-y-3">
          <div>
            <div className="label-mono mb-1.5">Check interval</div>
            <div className="flex flex-wrap gap-1.5">
              {[
                { sec: 30, label: '30s' },
                { sec: 60, label: '1m' },
                { sec: 120, label: '2m' },
                { sec: 300, label: '5m' },
              ].map(({ sec, label }) => (
                <button
                  key={sec}
                  type="button"
                  onClick={() => setInterval(sec)}
                  className={clsx(
                    'px-2.5 h-7 text-[10px] font-mono uppercase tracking-wider border transition-colors',
                    livePrefs.pollingIntervalActive === sec
                      ? 'border-accent/50 bg-accent/10 text-accent'
                      : 'border-border text-fg-muted hover:text-fg hover:bg-bg-hover'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <IosToggle
            label="Adaptive polling (faster when mail is active)"
            checked={livePrefs.adaptivePolling}
            onChange={setAdaptive}
          />

          <div className="label-mono pt-1">Auto-actions (no approval)</div>
          <IosToggle
            label="Apply existing rules"
            checked={livePrefs.autoActions.applyExistingRules}
            onChange={(v) => setAuto('applyExistingRules', v)}
          />
          <IosToggle
            label="Block listed senders"
            checked={livePrefs.autoActions.blockListedSenders}
            onChange={(v) => setAuto('blockListedSenders', v)}
          />
          <IosToggle
            label="Auto-archive newsletters"
            checked={livePrefs.autoActions.autoArchiveNewsletters}
            onChange={(v) => setAuto('autoArchiveNewsletters', v)}
          />
          <IosToggle
            label="Auto-sort known senders"
            checked={livePrefs.autoActions.autoSortKnownSenders}
            onChange={(v) => setAuto('autoSortKnownSenders', v)}
          />

          <div className="label-mono pt-1">Notifications</div>
          <IosToggle
            label="Badge for new emails"
            checked={livePrefs.notifications.showNewEmailBadge}
            onChange={(v) => setNotif('showNewEmailBadge', v)}
          />
          <IosToggle
            label="Ring bell for approvals"
            checked={livePrefs.notifications.ringBellOnApprovals}
            onChange={(v) => setNotif('ringBellOnApprovals', v)}
          />
          <IosToggle
            label="Show approval popup on focus"
            checked={livePrefs.notifications.autoShowModalOnFocus}
            onChange={(v) => setNotif('autoShowModalOnFocus', v)}
          />
        </div>
      )}
    </>
  );

  if (variant === 'inline') {
    return <div className="panel-inset p-4">{inner}</div>;
  }

  return <div className="panel p-5">{inner}</div>;
}
