import { useState } from 'react';
import { Loader2, Radio } from 'lucide-react';
import clsx from 'clsx';
import { useLiveSyncStore } from '@/stores/liveSyncStore';
import { useLiveStatus } from '@/hooks/useLiveSync';
import { usePrefsStore } from '@/stores/prefsStore';
import { Icon } from '@/components/ui/Icon';

function relTime(ts: number | null | undefined): string {
  if (!ts) return '—';
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  return `${Math.floor(s / 60)}m ago`;
}

export function LiveStatusIndicator() {
  const status = useLiveStatus();
  const liveEnabled = usePrefsStore((s) => s.prefs.liveSync.enabled);
  const setLiveSyncEnabled = useLiveSyncStore((s) => s.setLiveSyncEnabled);
  const pauseSync = useLiveSyncStore((s) => s.pauseSync);
  const checkNow = useLiveSyncStore((s) => s.checkNow);
  const [popover, setPopover] = useState(false);

  const accounts = status?.accounts ?? [];
  const anyPolling = accounts.some((a) => a.status === 'polling');
  const anyError = accounts.some((a) => a.status === 'error');
  const anyPaused = !liveEnabled || accounts.some((a) => a.status === 'paused');

  let label = 'Live sync off';
  let statusIcon: typeof Radio | typeof Loader2 = Radio;
  let statusClass = 'text-fg-subtle';
  let spin = false;

  if (liveEnabled && status?.enabled) {
    if (anyPolling) {
      label = 'Checking…';
      statusIcon = Loader2;
      statusClass = 'text-accent';
      spin = true;
    } else if (anyError) {
      label = 'Sync error';
      statusClass = 'text-danger';
    } else if (anyPaused) {
      label = 'Sync paused';
      statusClass = 'text-warn';
    } else {
      label = 'Live sync on';
      statusClass = 'text-ok';
    }
  }

  const primary = accounts[0];

  return (
    <div className="relative px-3 pb-2">
      <button
        type="button"
        onClick={() => setPopover(!popover)}
        className="w-full flex items-center gap-2 text-left text-[10px] font-mono uppercase tracking-wider text-fg-muted hover:text-fg py-0.5"
        title={
          primary?.lastPollAt
            ? `Last checked: ${relTime(primary.lastPollAt)} · Next: in ${primary.nextPollAt ? Math.max(0, Math.floor((primary.nextPollAt - Date.now()) / 1000)) : '?'}s`
            : undefined
        }
      >
        <Icon icon={statusIcon} size="xs" spin={spin} className={statusClass} />
        <span className="truncate">{label}</span>
      </button>

      {popover && (
        <div className="absolute left-2 right-2 bottom-full mb-2 p-3 bg-bg-elevated border border-border rounded-md shadow-xl z-40 text-[11px]">
          <div className="font-medium text-fg mb-2">Live Sync Status</div>
          {accounts.length === 0 ? (
            <p className="text-fg-muted">No accounts polling yet.</p>
          ) : (
            accounts.map((a) => (
              <div key={a.accountId} className="mb-2 last:mb-0">
                <div className="flex justify-between text-fg gap-2">
                  <span className="truncate">{a.accountId.split(':')[1] ?? a.accountId}</span>
                  <span className="capitalize text-fg-muted shrink-0">{a.status}</span>
                </div>
                <div className="text-fg-subtle text-[10px]">
                  Last: {relTime(a.lastPollAt)} · Next:{' '}
                  {a.nextPollAt
                    ? `${Math.max(0, Math.floor((a.nextPollAt - Date.now()) / 1000))}s`
                    : '—'}
                </div>
              </div>
            ))
          )}
          <div className="flex flex-wrap gap-2 mt-3 pt-2 border-t border-border-subtle">
            <button
              type="button"
              className="text-accent font-mono uppercase text-[10px]"
              onClick={() => void (liveEnabled ? pauseSync() : setLiveSyncEnabled(true))}
            >
              {liveEnabled ? 'Pause sync' : 'Enable sync'}
            </button>
            <button
              type="button"
              className="text-accent font-mono uppercase text-[10px]"
              onClick={() => void checkNow()}
            >
              Check now
            </button>
            <button
              type="button"
              className="text-fg-muted font-mono uppercase text-[10px]"
              onClick={() => void setLiveSyncEnabled(!liveEnabled)}
            >
              {liveEnabled ? 'Turn off' : 'Turn on'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
