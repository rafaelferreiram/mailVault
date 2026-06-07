import { useAccountsStore } from '@/stores/accountsStore';
import { useUserStore } from '@/stores/userStore';
import { usePrefsStore } from '@/stores/prefsStore';
import { useUIStore, type Route } from '@/stores/uiStore';
import { useSyncStore } from '@/stores/syncStore';
import { useMailboxStore } from '@/stores/mailboxStore';
import { useFoldersStore } from '@/stores/foldersStore';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { TEST_ACCOUNT, TEST_PREFS, TEST_USER } from './fixtures';
import { rangeFromKey } from '@/lib/timeRange';

export function resetTestStores() {
  useUIStore.setState({
    route: 'dashboard',
    selectedSenders: new Set(),
    expandedSender: null,
    reviewOpen: false,
    movePickerOpen: false,
    movePickerSenders: [],
    toast: null,
    pendingUndo: null,
    shortcutsOpen: false,
    compact: false,
    sendersSearch: null,
    sendersFilter: 'all',
  });

  useUserStore.setState({
    user: TEST_USER,
    hasAnyUser: true,
    loading: false,
    busy: false,
    error: null,
    errorField: null,
  });

  useAccountsStore.setState({
    accounts: [TEST_ACCOUNT],
    activeId: TEST_ACCOUNT.id,
    loading: false,
    loginInProgress: null,
    error: null,
    errorCode: null,
  });

  usePrefsStore.setState({
    prefs: structuredClone(TEST_PREFS),
    loaded: true,
    panelOpen: false,
    wizardOpen: false,
  });

  useSyncStore.setState({
    byAccount: {
      [TEST_ACCOUNT.id]: {
        syncId: null,
        active: false,
        drawerOpen: false,
        drawerCollapsed: true,
        stage: null,
        stats: {
          emailsFetched: 120,
          sendersDiscovered: 24,
          bytesAccounted: 48_000_000,
          newslettersDetected: 8,
          suggestionsBuilt: 3,
        },
        log: [],
        startedAt: null,
        completedAt: Date.now() - 3600_000,
        error: null,
        estimatedDurationMs: null,
        messages: [],
        senderGroups: [],
        suggestions: [],
        probes: { '30d': { count: 500, bytes: 30_000_000 } },
        selectedRange: rangeFromKey('30d'),
      },
    },
  });

  useMailboxStore.setState({
    folder: { id: 'inbox', name: 'Inbox' },
    messages: [],
    source: 'cache',
    loading: false,
    error: null,
    selectedMessageId: null,
    preview: null,
    previewLoading: false,
  });

  useFoldersStore.setState({
    byAccount: {},
  });

  useOnboardingStore.setState({
    completed: true,
    skipped: false,
    currentStep: 0,
    lastSeenAt: Date.now(),
    completedAt: Date.now(),
    open: false,
    showResume: false,
    showSkipConfirm: false,
    bootstrapped: true,
  });
}

export function setTestRoute(route: Route) {
  useUIStore.setState({ route });
}

export function applyLayoutTemplate(layout: string) {
  document.documentElement.setAttribute('data-layout', layout);
}
