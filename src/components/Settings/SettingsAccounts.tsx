import { useState } from 'react';
import clsx from 'clsx';
import { LogIn, LogOut, RefreshCw, Pencil, Save, X } from 'lucide-react';
import { useAccountsStore } from '@/stores/accountsStore';
import { Button } from '../ui/Button';
import { ConfirmModal } from '../ui/ConfirmModal';
import { Icon } from '../ui/Icon';
import { Avatar } from '../ui/Avatar';
import { GoogleIcon, OutlookIcon } from '../ui/ProviderIcon';
import { SettingsCollapsibleSection } from './SettingsCollapsibleSection';
import { useUIStore } from '@/stores/uiStore';
import { formatNumber, relativeTime } from '@/lib/format';

export function SettingsAccounts() {
  const accounts = useAccountsStore((s) => s.accounts);
  const activeId = useAccountsStore((s) => s.activeId);
  const loginInProgress = useAccountsStore((s) => s.loginInProgress);
  const setActive = useAccountsStore((s) => s.setActive);
  const login = useAccountsStore((s) => s.login);
  const reauth = useAccountsStore((s) => s.reauth);
  const logout = useAccountsStore((s) => s.logout);
  const refresh = useAccountsStore((s) => s.refresh);
  const showToast = useUIStore((s) => s.showToast);

  const [disconnecting, setDisconnecting] = useState<{ id: string; email: string } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [savingName, setSavingName] = useState(false);

  const startEdit = (id: string, currentName: string) => {
    setEditingId(id);
    setEditName(currentName);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName('');
  };

  const saveName = async (accountId: string) => {
    setSavingName(true);
    try {
      const updated = await window.mailvault.authUpdateAccount(accountId, {
        name: editName.trim(),
      });
      if (updated) {
        await refresh();
        showToast('ok', 'Account label updated');
        cancelEdit();
      } else {
        showToast('err', 'Failed to update account');
      }
    } catch (e) {
      showToast('err', (e as Error).message);
    } finally {
      setSavingName(false);
    }
  };

  return (
    <>
      <SettingsCollapsibleSection
        id="accounts-connected"
        title="Linked email accounts"
        subtitle="Gmail and Outlook mailboxes connected via OAuth. Provider passwords are never stored."
      >
        {accounts.length === 0 ? (
          <p className="text-[12px] text-fg-subtle font-mono">No email accounts linked yet.</p>
        ) : (
          <div className="space-y-3">
            {accounts.map((a) => {
              const active = a.id === activeId;
              const needsReauth = a.needsReauth;
              const editing = editingId === a.id;
              return (
                <div
                  key={a.id}
                  className={clsx(
                    'panel-inset p-4 space-y-3',
                    active && 'border-accent/30',
                    needsReauth && 'border-warn/40'
                  )}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      {a.provider === 'google' ? (
                        <GoogleIcon size={16} />
                      ) : (
                        <OutlookIcon size={16} />
                      )}
                      <Avatar email={a.email} name={a.name} url={a.avatarUrl} size={40} />
                      <div className="min-w-0 flex-1">
                        {editing ? (
                          <div className="flex flex-wrap items-center gap-2">
                            <input
                              className="input h-8 flex-1 min-w-[160px]"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              maxLength={64}
                              placeholder="Display label"
                              autoFocus
                            />
                            <Button
                              variant="primary"
                              size="xs"
                              iconLeft={<Save className="w-3 h-3" />}
                              onClick={() => void saveName(a.id)}
                              disabled={savingName}
                            >
                              Save
                            </Button>
                            <Button variant="ghost" size="xs" onClick={cancelEdit}>
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="text-[14px] font-medium text-fg truncate">{a.name}</div>
                            <button
                              type="button"
                              className="text-fg-subtle hover:text-accent shrink-0"
                              onClick={() => startEdit(a.id, a.name)}
                              title="Edit label"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                        <div className="text-[12px] text-fg-muted truncate mt-0.5">{a.email}</div>
                        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-[10px] font-mono uppercase tracking-wider text-fg-subtle">
                          <span>{a.provider === 'google' ? 'Gmail' : 'Outlook'}</span>
                          {active && <span className="text-accent">Active</span>}
                          {needsReauth && <span className="text-warn">Reconnect required</span>}
                          {a.lastSyncedAt && (
                            <span className="normal-case tracking-normal">
                              Last sync {relativeTime(a.lastSyncedAt)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0 flex-wrap sm:justify-end">
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
                </div>
              );
            })}
          </div>
        )}
      </SettingsCollapsibleSection>

      <SettingsCollapsibleSection
        id="accounts-add"
        title="Connect email account"
        subtitle="Link Gmail or Outlook via OAuth — up to four accounts per MailVault user."
      >
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
        <p className="text-[11px] text-fg-muted mt-3 max-w-xl">
          OAuth opens in your browser. MailVault stores tokens in the OS keychain and never sees your
          email provider password.
        </p>
        {accounts.length >= 4 && (
          <p className="text-[10px] text-fg-subtle font-mono mt-2">
            Maximum of {formatNumber(4)} accounts. Disconnect one to add another.
          </p>
        )}
      </SettingsCollapsibleSection>

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
          showToast('ok', 'Account disconnected');
        }}
      />
    </>
  );
}
