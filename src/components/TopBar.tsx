import { useState } from 'react';
import { Plus, LogOut, Keyboard, Rows3, AlertTriangle } from 'lucide-react';
import clsx from 'clsx';
import { useAccountsStore } from '@/stores/accountsStore';
import { useUserStore } from '@/stores/userStore';
import { useUIStore } from '@/stores/uiStore';
import { GoogleIcon, OutlookIcon } from './ui/ProviderIcon';
import { Avatar } from './ui/Avatar';
import { UserAvatar } from './ui/UserAvatar';
import { BrandLockupHorizontal } from './Brand';
import { ConfirmModal } from './ui/ConfirmModal';
import { NotificationBell } from './Notifications/NotificationBell';
import { Icon, topBarIconBtn, topBarIconBtnActive } from './ui/Icon';
import { usePrefsStore } from '@/stores/prefsStore';

export function TopBar() {
  const accounts = useAccountsStore((s) => s.accounts);
  const activeId = useAccountsStore((s) => s.activeId);
  const setActive = useAccountsStore((s) => s.setActive);
  const login = useAccountsStore((s) => s.login);
  const logout = useAccountsStore((s) => s.logout);
  const reauth = useAccountsStore((s) => s.reauth);
  const loginInProgress = useAccountsStore((s) => s.loginInProgress);
  const setShortcutsOpen = useUIStore((s) => s.setShortcutsOpen);
  const setRoute = useUIStore((s) => s.setRoute);
  const compact = useUIStore((s) => s.compact);
  const toggleCompact = useUIStore((s) => s.toggleCompact);
  const showToast = useUIStore((s) => s.showToast);
  const me = useUserStore((s) => s.user);
  const userLogout = useUserStore((s) => s.logout);
  const showAccountTabs = usePrefsStore((s) => s.prefs.panels.accountTabs);

  const [adding, setAdding] = useState(false);
  // Confirm dialogs (audit P2-13 — replaced native confirm()).
  const [disconnecting, setDisconnecting] = useState<{ id: string; email: string } | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  const onAdd = async (p: 'google' | 'microsoft') => {
    const profile = await login(p);
    setAdding(false);
    if (profile) showToast('ok', `Connected ${profile.email}`);
    else {
      const err = useAccountsStore.getState().error;
      if (err) showToast('err', err);
    }
  };

  return (
    <header className="app-titlebar h-11 shrink-0 border-b border-border bg-bg-elevated flex items-center drag-region">
      {/* Brand — `mac-titlebar-pad` reserves room for the macOS traffic
          lights (close / minimize / maximize) that hiddenInset paints
          over our content. No-op on Linux/Windows. */}
      <button
        type="button"
        onClick={() => setRoute('dashboard')}
        className="flex items-center px-4 h-full no-drag border-r border-border-subtle text-fg mac-titlebar-pad hover:bg-bg-hover transition-colors cursor-pointer"
        title="Go to Dashboard"
        aria-label="Go to Dashboard"
      >
        <BrandLockupHorizontal className="h-[18px] w-auto" />
      </button>

      {/* Account tabs — hideable via Personalization → Panels */}
      {showAccountTabs ? (
        <div
          data-tour="account-tabs"
          className="flex items-stretch h-full no-drag flex-1 min-w-0"
        >
          {accounts.map((a) => {
          const active = a.id === activeId;
          return (
            <button
              key={a.id}
              onClick={() => setActive(a.id)}
              className={clsx(
                'group relative px-3 flex items-center gap-2.5 border-r border-border-subtle transition-colors min-w-0 max-w-[260px]',
                active
                  ? 'bg-bg text-fg'
                  : 'text-fg-muted hover:text-fg hover:bg-bg-hover'
              )}
            >
              {active && (
                <span className="absolute top-0 left-0 right-0 h-px bg-accent" />
              )}
              <div className="relative shrink-0">
                <Avatar email={a.email} name={a.name} url={a.avatarUrl} size={20} />
                <span className="absolute -bottom-1 -right-1 bg-bg-elevated border border-border-subtle p-0.5">
                  {a.provider === 'google' ? <GoogleIcon size={8} /> : <OutlookIcon size={8} />}
                </span>
              </div>
              <div className="min-w-0 text-left">
                <div className="text-[11px] truncate leading-tight flex items-center gap-1">
                  {a.name}
                  {a.needsReauth && (
                    <Icon icon={AlertTriangle} size="xs" className="text-warn" />
                  )}
                </div>
                <div className="text-[9px] font-mono text-fg-subtle uppercase tracking-widest truncate">
                  {a.needsReauth ? 'NEEDS RECONNECT' : a.email}
                </div>
              </div>
              {active && !a.needsReauth && (
                <span className="w-1 h-1 rounded-full bg-accent shrink-0 ml-1 animate-pulse-soft" />
              )}
              {a.needsReauth && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={async (e) => {
                    e.stopPropagation();
                    const profile = await reauth(a.id);
                    if (profile) showToast('ok', `Reconnected ${profile.email}`);
                    else {
                      const err = useAccountsStore.getState().error;
                      if (err) showToast('err', err);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.stopPropagation();
                      e.preventDefault();
                      void reauth(a.id);
                    }
                  }}
                  className="ml-1 px-1.5 h-5 inline-flex items-center text-[9px] font-mono uppercase tracking-wider border border-warn text-warn hover:bg-warn/10 cursor-pointer"
                  title="Reconnect this account"
                >
                  Reconnect
                </span>
              )}
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  setDisconnecting({ id: a.id, email: a.email });
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.stopPropagation();
                    e.preventDefault();
                    setDisconnecting({ id: a.id, email: a.email });
                  }
                }}
                className="inline-flex items-center text-fg-subtle hover:text-danger ml-1 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                title="Disconnect"
              >
                <Icon icon={LogOut} size="xs" />
              </span>
            </button>
          );
        })}

        {/* + Add account */}
        {accounts.length < 4 && (
          <div
            data-tour="add-account"
            className="flex items-stretch border-r border-border-subtle"
          >
            {!adding ? (
              <button
                onClick={() => setAdding(true)}
                className="px-3 flex items-center gap-1.5 text-fg-muted hover:text-accent hover:bg-bg-hover text-[11px] font-mono uppercase tracking-wider"
              >
                <Icon icon={Plus} size="xs" />
                Add
              </button>
            ) : (
              <div className="flex items-stretch animate-fade-in">
                <button
                  onClick={() => onAdd('google')}
                  disabled={!!loginInProgress}
                  className="px-3 flex items-center gap-2 text-fg hover:bg-bg-hover text-[11px] disabled:opacity-50"
                >
                  <GoogleIcon size={12} />
                  {loginInProgress === 'google' ? 'AUTH…' : 'Gmail'}
                </button>
                <button
                  onClick={() => onAdd('microsoft')}
                  disabled={!!loginInProgress}
                  className="px-3 flex items-center gap-2 text-fg hover:bg-bg-hover text-[11px] disabled:opacity-50"
                >
                  <OutlookIcon size={12} />
                  {loginInProgress === 'microsoft' ? 'AUTH…' : 'Outlook'}
                </button>
                <button
                  onClick={() => setAdding(false)}
                  className="px-2 text-fg-subtle hover:text-fg text-[11px]"
                >
                  ✕
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      ) : (
        <div className="flex-1 no-drag" />
      )}

      {/* Right utilities */}
      <div className="flex items-center gap-1 px-3 h-full no-drag border-l border-border-subtle">
        <NotificationBell />
        <button
          onClick={toggleCompact}
          className={clsx(
            compact ? topBarIconBtnActive : topBarIconBtn,
            'relative'
          )}
          title={compact ? 'Compact mode on' : 'Toggle compact density'}
        >
          <Icon icon={Rows3} size="sm" />
        </button>
        <button
          onClick={() => setShortcutsOpen(true)}
          className={topBarIconBtn}
          title="Keyboard shortcuts (?)"
        >
          <Icon icon={Keyboard} size="sm" />
        </button>
        {me && (
          <div className="flex items-center gap-2 ml-2 pl-2 border-l border-border-subtle max-w-[180px]">
            <UserAvatar user={me} size={22} />
            <span className="text-[11px] text-fg truncate" title={me.email}>
              {me.displayName}
            </span>
            <button
              onClick={() => setSigningOut(true)}
              className="inline-flex items-center text-fg-subtle hover:text-danger shrink-0"
              title="Sign out of MailVault"
            >
              <Icon icon={LogOut} size="xs" />
            </button>
          </div>
        )}
      </div>

      <ConfirmModal
        open={!!disconnecting}
        title="Disconnect account"
        destructive
        confirmLabel="Disconnect"
        message={
          <>
            Disconnect <span className="font-mono text-accent">{disconnecting?.email}</span>?
            Local sync data is preserved; you can reconnect anytime.
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

      <ConfirmModal
        open={signingOut}
        title="Sign out of MailVault"
        destructive
        confirmLabel="Sign out"
        message="You'll need to sign in again to access your linked email accounts. Your data and tokens stay on this device."
        onCancel={() => setSigningOut(false)}
        onConfirm={async () => {
          setSigningOut(false);
          await userLogout();
          showToast('ok', 'Signed out');
        }}
      />
    </header>
  );
}
