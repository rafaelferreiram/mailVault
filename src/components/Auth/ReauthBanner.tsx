import { AlertTriangle } from 'lucide-react';
import { useState } from 'react';
import { useAccountsStore } from '@/stores/accountsStore';
import { useUIStore } from '@/stores/uiStore';

export function ReauthBanner() {
  const accounts = useAccountsStore((s) => s.accounts);
  const reauth = useAccountsStore((s) => s.reauth);
  const showToast = useUIStore((s) => s.showToast);
  const [reconnecting, setReconnecting] = useState<string | null>(null);

  const stale = accounts.filter((a) => a.needsReauth);
  if (stale.length === 0) return null;

  const onReconnect = async (id: string) => {
    setReconnecting(id);
    const profile = await reauth(id);
    setReconnecting(null);
    if (profile) showToast('ok', `Reconnected ${profile.email}`);
    else {
      const err = useAccountsStore.getState().error;
      if (err) showToast('err', err);
    }
  };

  return (
    <div className="shrink-0 bg-warn/10 border-b border-warn/30">
      {stale.map((a) => (
        <div
          key={a.id}
          className="px-4 py-2 flex items-center gap-3 text-[12px]"
        >
          <AlertTriangle className="w-4 h-4 text-warn shrink-0" />
          <span className="text-fg">
            <span className="font-mono uppercase tracking-wider text-warn text-[10px] mr-2">
              REAUTH REQUIRED
            </span>
            {a.email} session expired or was revoked. Reconnect to continue syncing.
          </span>
          <div className="flex-1" />
          <button
            onClick={() => onReconnect(a.id)}
            disabled={reconnecting === a.id}
            className="h-7 px-3 text-[10px] font-mono uppercase tracking-wider border border-warn text-warn hover:bg-warn hover:text-bg disabled:opacity-50"
          >
            {reconnecting === a.id ? 'Authorizing…' : `Reconnect ${a.provider === 'google' ? 'Gmail' : 'Outlook'}`}
          </button>
        </div>
      ))}
    </div>
  );
}
