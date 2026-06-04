import { useEffect, useState, useCallback } from 'react';
import type { OAuthConfigStatus } from '@shared/types';
import { TopBar } from './components/TopBar';
import { Sidebar } from './components/Sidebar';
import { Toast } from './components/ui/Toast';
import { Dashboard } from './components/Dashboard';
import { SuggestionFeed } from './components/Suggestions';
import { Analyze } from './components/Analyze';
import { InboxCleaner as Senders } from './components/InboxCleaner';
import { Mailbox } from './components/Mailbox';
import { Folders } from './components/Folders';
import { Rules } from './components/Rules';
import { Blocked } from './components/Blocked';
import { Settings } from './components/Settings';
import { ConnectFirstAccount } from './components/Auth/ConnectFirstAccount';
import { LoginScreen } from './components/Auth/LoginScreen';
import { OAuthSetupScreen } from './components/Auth/OAuthSetupScreen';
import { AuthInProgressPanel } from './components/Auth/AuthInProgressPanel';
import { SyncDrawer } from './components/SyncDrawer';
import { MovePicker } from './components/MovePicker';
import { ShortcutsOverlay } from './components/Shortcuts';
import { ReauthBanner } from './components/Auth/ReauthBanner';
import { OnboardingTour } from './components/Onboarding';
import { WhatsNewModal } from './components/WhatsNew';
import { useAccountsStore } from './stores/accountsStore';
import { useUserStore } from './stores/userStore';
import { useUIStore } from './stores/uiStore';
import { useSyncStore } from './stores/syncStore';
import { useOnboardingStore } from './stores/onboardingStore';
import { usePrefsStore } from './stores/prefsStore';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { PersonalizationPanel } from './components/Personalization/PersonalizationPanel';
import { PersonalizationWizard } from './components/Personalization/PersonalizationWizard';
import { NotificationBell } from './components/Notifications/NotificationBell';
import { LiveStatusIndicator } from './components/Notifications/LiveStatusIndicator';
import { NotificationCenter } from './components/Notifications';
import { useLiveSyncSubscriptions } from './hooks/useLiveSync';
import { useLiveSyncStore } from './stores/liveSyncStore';
import clsx from 'clsx';

export default function App() {
  const user = useUserStore((s) => s.user);
  const userLoading = useUserStore((s) => s.loading);
  const bootstrapUser = useUserStore((s) => s.bootstrap);
  const refresh = useAccountsStore((s) => s.refresh);
  const accounts = useAccountsStore((s) => s.accounts);
  const setActive = useAccountsStore((s) => s.setActive);
  const route = useUIStore((s) => s.route);
  const setRoute = useUIStore((s) => s.setRoute);
  const setShortcutsOpen = useUIStore((s) => s.setShortcutsOpen);
  const toggleCompact = useUIStore((s) => s.toggleCompact);
  const pendingUndo = useUIStore((s) => s.pendingUndo);
  const setPendingUndo = useUIStore((s) => s.setPendingUndo);
  const showToast = useUIStore((s) => s.showToast);
  const startSync = useSyncStore((s) => s.start);
  const cancelSync = useSyncStore((s) => s.cancel);
  const setCollapsed = useSyncStore((s) => s.setCollapsed);
  const activeId = useAccountsStore((s) => s.activeId);
  const bootstrapOnboarding = useOnboardingStore((s) => s.bootstrap);
  const autoLaunchOnboarding = useOnboardingStore((s) => s.autoLaunchIfNeeded);
  const openOnboardingManual = useOnboardingStore((s) => s.openManual);
  const loadPrefs = usePrefsStore((s) => s.load);
  const prefsLoaded = usePrefsStore((s) => s.loaded);
  const togglePrefsPanel = usePrefsStore((s) => s.togglePanel);
  const autoLaunchWizard = usePrefsStore((s) => s.autoLaunchWizardIfNeeded);
  const wizardOpen = usePrefsStore((s) => s.wizardOpen);
  const bootstrapLiveSync = useLiveSyncStore((s) => s.bootstrap);

  useLiveSyncSubscriptions();

  const [oauthStatus, setOauthStatus] = useState<OAuthConfigStatus | null>(null);
  const refreshOauthStatus = useCallback(async () => {
    try {
      const s = await window.mailvault.oauthConfigStatus();
      setOauthStatus(s);
    } catch (err) {
      console.warn('[oauth] config-status failed', err);
    }
  }, []);
  useEffect(() => {
    void refreshOauthStatus();
  }, [refreshOauthStatus]);

  useEffect(() => {
    void bootstrapUser();
  }, [bootstrapUser]);

  // Personalization: hydrate prefs from disk into the renderer store. The
  // preload script already painted the correct theme on first frame; this
  // call just gives React access to the values for the Personalization Panel.
  useEffect(() => {
    void loadPrefs();
  }, [loadPrefs]);

  useEffect(() => {
    if (user) void refresh();
  }, [user, refresh]);

  // Onboarding bootstrap. We hydrate progress regardless of login state, so
  // the resume modal works the moment the user signs in.
  useEffect(() => {
    void bootstrapOnboarding();
  }, [bootstrapOnboarding]);

  // Personalization wizard: first run after account creation, before email
  // accounts are linked. Full-screen — no app chrome behind it.
  useEffect(() => {
    if (!user || !prefsLoaded) return;
    if (accounts.length > 0) return;
    autoLaunchWizard();
  }, [user, prefsLoaded, accounts.length, autoLaunchWizard]);

  // Auto-launch the tour once the user has signed in AND linked at least one
  // email account. Skip while the personalization wizard is still open.
  useEffect(() => {
    if (!user) return;
    if (accounts.length === 0) return;
    if (usePrefsStore.getState().wizardOpen) return;
    autoLaunchOnboarding();
  }, [user, accounts.length, autoLaunchOnboarding]);

  useEffect(() => {
    if (user && accounts.length > 0) void bootstrapLiveSync();
  }, [user, accounts.length, bootstrapLiveSync]);

  // Auto-route to the Suggestions feed when intelligence finishes, but only
  // if the user is currently looking at the Dashboard or Analyze tab (i.e. we
  // don't yank them away from a workflow they explicitly chose).
  useEffect(() => {
    const off = window.mailvault.onIntelligenceComplete(({ accountId }) => {
      if (accountId !== activeId) return;
      if (!usePrefsStore.getState().prefs.panels.suggestionFeed) return;
      const cur = useUIStore.getState().route;
      if (cur === 'dashboard' || cur === 'analyze') {
        useUIStore.getState().setRoute('suggestions');
      }
    });
    return off;
  }, [activeId]);

  // Help-menu IPC bridge: react to native menu items + CMD+SHIFT+?.
  useEffect(() => {
    const offRestart = window.mailvault.onOnboardingRestart(() => openOnboardingManual());
    const offShortcuts = window.mailvault.onShowShortcuts(() =>
      useUIStore.getState().setShortcutsOpen(true)
    );
    const offWhatsNew = window.mailvault.onShowWhatsNew(() => {
      const { setRoute } = useUIStore.getState();
      setRoute('settings');
      // Defer-open via a custom event the WhatsNewModal listens to.
      window.dispatchEvent(new CustomEvent('mailvault:open-whats-new'));
    });
    const offPrefs = window.mailvault.onOpenPersonalization(() =>
      usePrefsStore.getState().setPanelOpen(true)
    );
    return () => {
      offRestart?.();
      offShortcuts?.();
      offWhatsNew?.();
      offPrefs?.();
    };
  }, [openOnboardingManual]);

  // Treat tour-open as "shortcuts paused" — except the restart shortcut itself.
  const guard = (fn: (e: KeyboardEvent) => void) => (e: KeyboardEvent) => {
    if (useOnboardingStore.getState().open) return;
    if (usePrefsStore.getState().wizardOpen) return;
    fn(e);
  };

  // ⚠️  Keep `src/lib/shortcuts.ts` in sync when adding/removing keys here —
  // the `?` overlay and onboarding cheat-sheet read from that file.
  useKeyboardShortcuts({
    'cmd+shift+?': (e) => {
      e.preventDefault();
      if (useOnboardingStore.getState().open) return; // Already running.
      openOnboardingManual();
    },
    'ctrl+shift+?': (e) => {
      e.preventDefault();
      if (useOnboardingStore.getState().open) return;
      openOnboardingManual();
    },
    '?': guard((e) => {
      e.preventDefault();
      setShortcutsOpen(true);
    }),
    '1': guard(() => setRoute('dashboard')),
    '2': guard(() => setRoute('suggestions')),
    '3': guard(() => setRoute('analyze')),
    '4': guard(() => setRoute('senders')),
    '5': guard(() => setRoute('folders')),
    '6': guard(() => setRoute('rules')),
    '7': guard(() => setRoute('blocked')),
    '8': guard(() => setRoute('settings')),
    'cmd+1': guard(() => accounts[0] && setActive(accounts[0].id)),
    'cmd+2': guard(() => accounts[1] && setActive(accounts[1].id)),
    'cmd+3': guard(() => accounts[2] && setActive(accounts[2].id)),
    'cmd+4': guard(() => accounts[3] && setActive(accounts[3].id)),
    'ctrl+1': guard(() => accounts[0] && setActive(accounts[0].id)),
    'ctrl+2': guard(() => accounts[1] && setActive(accounts[1].id)),
    'ctrl+3': guard(() => accounts[2] && setActive(accounts[2].id)),
    'ctrl+4': guard(() => accounts[3] && setActive(accounts[3].id)),
    'cmd+,': guard((e) => {
      e.preventDefault();
      togglePrefsPanel();
    }),
    'ctrl+,': guard((e) => {
      e.preventDefault();
      togglePrefsPanel();
    }),
    'cmd+d': guard((e) => {
      e.preventDefault();
      toggleCompact();
    }),
    'ctrl+d': guard((e) => {
      e.preventDefault();
      toggleCompact();
    }),
    'cmd+j': guard((e) => {
      e.preventDefault();
      const sync = useSyncStore.getState();
      const cur = activeId ? sync.byAccount[activeId] : null;
      setCollapsed(!cur?.drawerCollapsed);
    }),
    'ctrl+j': guard((e) => {
      e.preventDefault();
      const sync = useSyncStore.getState();
      const cur = activeId ? sync.byAccount[activeId] : null;
      setCollapsed(!cur?.drawerCollapsed);
    }),
    s: guard(() => {
      if (route === 'analyze' && activeId) {
        const sync = useSyncStore.getState().byAccount[activeId];
        if (sync && !sync.active) {
          void startSync(activeId, { range: sync.selectedRange, maxMessages: 10_000 });
        }
      }
    }),
    'shift+c': guard(() => {
      if (activeId) cancelSync(activeId);
    }),
    'cmd+z': async (e) => {
      if (!pendingUndo) return;
      e.preventDefault();
      const u = pendingUndo;
      setPendingUndo(null);
      try {
        const result = await window.mailvault.restoreEmails(u.accountId, u.messageIds);
        showToast('ok', `Restored ${result.restored} email${result.restored === 1 ? '' : 's'}`);
      } catch (err) {
        showToast('err', `Undo failed: ${(err as Error).message}`);
      }
    },
    'ctrl+z': async (e) => {
      if (!pendingUndo) return;
      e.preventDefault();
      const u = pendingUndo;
      setPendingUndo(null);
      try {
        const result = await window.mailvault.restoreEmails(u.accountId, u.messageIds);
        showToast('ok', `Restored ${result.restored} email${result.restored === 1 ? '' : 's'}`);
      } catch (err) {
        showToast('err', `Undo failed: ${(err as Error).message}`);
      }
    },
  });

  // Loading initial session.
  if (userLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-bg">
        <div className="font-mono text-[11px] text-fg-muted uppercase tracking-widest animate-pulse-soft">
          Loading…
        </div>
      </div>
    );
  }

  // Not signed in to MailVault yet — show login/register first.
  if (!user) {
    return (
      <div className="h-screen w-screen flex flex-col bg-bg">
        <LoginScreen />
        <Toast />
        <PersonalizationPanel />
        <PersonalizationWizard />
      </div>
    );
  }

  // Signed in but no email accounts linked yet.
  if (accounts.length === 0) {
    if (wizardOpen) {
      return (
        <>
          <PersonalizationWizard />
          <Toast />
        </>
      );
    }
    const credsMissing =
      oauthStatus !== null &&
      !oauthStatus.google.configured &&
      !oauthStatus.microsoft.configured;
    return (
      <div className="h-screen w-screen flex flex-col bg-bg">
        <TopBar />
        {credsMissing ? (
          <OAuthSetupScreen status={oauthStatus!} onRecheck={refreshOauthStatus} />
        ) : (
          <ConnectFirstAccount />
        )}
        <Toast />
        <ShortcutsOverlay />
        <WhatsNewModal />
        <OnboardingTour />
        <AuthInProgressPanel />
        <PersonalizationPanel />
        <PersonalizationWizard />
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-bg overflow-hidden">
      <TopBar />
      <ReauthBanner />
      <div className="app-shell flex-1 flex min-h-0">
        <Sidebar />
        <main
          className={clsx(
            'app-main flex-1 flex flex-col min-w-0 bg-bg',
            `route-${route}`
          )}
        >
          {route === 'dashboard' && <Dashboard />}
          {route === 'suggestions' && <SuggestionFeed />}
          {route === 'analyze' && <Analyze />}
          {route === 'senders' && <Senders />}
          {route === 'mailbox' && <Mailbox />}
          {route === 'folders' && <Folders />}
          {route === 'rules' && <Rules />}
          {route === 'blocked' && <Blocked />}
          {route === 'settings' && <Settings />}
          {route === 'notifications' && <NotificationCenter />}
        </main>
      </div>
      <SyncDrawer />
      {/* Bottom-of-screen anchor for the onboarding spotlight on Step 5
          (real drawer may not be present yet). 1px tall, transparent. */}
      <div
        data-tour="sync-drawer-anchor"
        aria-hidden
        className="pointer-events-none"
        style={{ position: 'fixed', left: 0, right: 0, bottom: 0, height: 1 }}
      />
      <MovePicker />
      <ShortcutsOverlay />
      <Toast />
      <WhatsNewModal />
      <OnboardingTour />
      <AuthInProgressPanel />
      <PersonalizationPanel />
      <PersonalizationWizard />
    </div>
  );
}
