import { useState } from 'react';
import clsx from 'clsx';
import { LogIn, LogOut, RefreshCw } from 'lucide-react';
import { useAccountsStore } from '@/stores/accountsStore';
import { Button } from '../ui/Button';
import { ConfirmModal } from '../ui/ConfirmModal';
import { Icon } from '../ui/Icon';

export function SettingsAccounts() {
  const accounts = useAccountsStore((s) => s.accounts);
  const activeId = useAccountsStore((s) => s.activeId);
  const loginInProgress = useAccountsStore((s) => s.loginInProgress);
  const setActive = useAccountsStore((s) => s.setActive);
  const login = useAccountsStore((s) => s.login);
  const reauth = useAccountsStore((s) => s.reauth);
  const logout = useAccountsStore((s) => s.logout);

  const [disconnecting, setDisconnecting] = useState<{ id: string; email: string } | null>(null);

  return (
    <>
      <div className="panel p-4">
        <div className="label-mono mb-1">Connected accounts</div>
        <p className="text-[12px] text-fg-muted mb-4">
          Link up to four Gmail or Outlook accounts. Live sync watches Inbox and Junk on each.
        </p>

        {accounts.length === 0 ? (
          <p className="text-[12px] text-fg-subtle font-mono">No accounts linked yet.</p>
        ) : (
          <div className="space-y-2">
            {accounts.map((a) => {
              const active = a.id === activeId;
              const needsReauth = a.needsReauth;
              return (
                <div
                  key={a.id}
                  className={clsx(
                    'panel-inset p-3 flex items-center gap-3',
                    active && 'border-accent/30'
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] text-fg truncate">{a.email}</div>
                    <div className="text-[10px] font-mono uppercase tracking-wider text-fg-subtle mt-0.5">
                      {a.provider === 'google' ? 'Gmail' : 'Outlook'}
                      {needsReauth && (
                        <span className="text-warn ml-2">· Reconnect required</span>
                      )}
                      {active && <span className="text-accent ml-2">· Active</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {!active && (
                      <Button variant="ghost" size="xs" onClick={() => setActive(a.id)}>
                        Make active
                      </Button>
                    )}
                    {needsReauth && (
                      <Button
                        variant="secondary"
                        size="xs"
                        iconLeft={<Icon icon={RefreshCw} size="xs" />}
                        onClick={() => void reauth(a.id)}
                      >
                        Reconnect
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="xs"
                      className="text-danger hover:text-danger"
                      iconLeft={<Icon icon={LogOut} size="xs" />}
                      onClick={() => setDisconnecting({ id: a.id, email: a.email })}
                    >
                      Disconnect
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="panel p-4">
        <div className="label-mono mb-3">Add account</div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            iconLeft={<Icon icon={LogIn} size="xs" />}
            disabled={!!loginInProgress || accounts.length >= 4}
            onClick={() => void login('google')}
          >
            {loginInProgress === 'google' ? 'Connecting…' : 'Connect Gmail'}
          </Button>
          <Button
            variant="secondary"
            iconLeft={<Icon icon={LogIn} size="xs" />}
            disabled={!!loginInProgress || accounts.length >= 4}
            onClick={() => void login('microsoft')}
          >
            {loginInProgress === 'microsoft' ? 'Connecting…' : 'Connect Outlook'}
          </Button>
        </div>
        {accounts.length >= 4 && (
          <p className="text-[10px] text-fg-subtle font-mono mt-2">
            Maximum of 4 accounts. Disconnect one to add another.
          </p>
        )}
      </div>

      <ConfirmModal
        open={!!disconnecting}
        title="Disconnect account"
        destructive
        confirmLabel="Disconnect"
        message={
          <>
            Disconnect <span className="font-mono text-accent">{disconnecting?.email}</span>? Local
            sync data is preserved; you can reconnect anytime.
          </>
        }
        onCancel={() => setDisconnecting(null)}
        onConfirm={async () => {
          if (!disconnecting) return;
          const id = disconnecting.id;
          setDisconnecting(null);
          await logout(id);
        }}
      />
    </>
  );
}
