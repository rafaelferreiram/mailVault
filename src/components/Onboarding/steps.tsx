import type { ReactNode } from 'react';
import type { Route } from '@/stores/uiStore';
import {
  HeroFlow,
  OAuthFlow,
  TimeRangeMock,
  SyncDrawerMock,
  SenderRowMock,
  SelectAnimateMock,
  ConfirmPanelMock,
  RulesBlockingMock,
  FoldersHowTo,
  CheatSheet,
} from './Visuals';

export interface OnboardingStep {
  id: number;
  type: 'modal' | 'spotlight';
  /** CSS selector to highlight; if missing or not found, falls back to centered. */
  target?: string;
  /** Switch to this route before showing the step. */
  goToRoute?: Route;
  /** If true, force the sync drawer open before this step. */
  preferredPlacement?: 'auto' | 'top' | 'bottom' | 'left' | 'right' | 'center';
  kicker?: string;
  headline: string;
  subtext: string;
  callout?: { type: 'tip' | 'safety' | 'trust' | 'note'; text: string };
  /** Optional inline visual rendered inside the tooltip. */
  visual?: ReactNode;
  primaryLabel?: string;
  primaryAction?: () => void;
}

/**
 * Builds the steps. Some steps need access to actions (e.g. step 11 navigates
 * to Analyze on click), so we accept handlers as a parameter.
 */
export function buildSteps(opts: {
  onFinishGoToAnalyze: () => void;
}): OnboardingStep[] {
  return [
    {
      id: 1,
      type: 'modal',
      kicker: 'Welcome',
      headline: 'Your inbox. Finally under control.',
      subtext:
        "MailVault isn't an email client — you won't read or write emails here. This is your cleanup and organization command center. Let's take 2 minutes to show you how it works.",
      visual: <HeroFlow />,
      primaryLabel: "Let's go →",
    },
    {
      id: 2,
      type: 'spotlight',
      target: '[data-tour="account-tabs"]',
      preferredPlacement: 'bottom',
      kicker: 'Step 2',
      headline: 'Your email accounts live here',
      subtext:
        "You can connect up to 4 accounts — Gmail, Hotmail, Outlook. Each one is independent. Click an account tab to work on it. You're looking at one account at a time.",
      callout: {
        type: 'note',
        text: "You haven't connected any accounts yet — we'll do that in a moment.",
      },
    },
    {
      id: 3,
      type: 'spotlight',
      target: '[data-tour="add-account"]',
      preferredPlacement: 'bottom',
      kicker: 'Step 3',
      headline: 'Connect an account',
      subtext:
        "Click '+' to link a Google or Microsoft account. A browser window opens — you log in there, not here. MailVault never sees your password. Ever.",
      callout: {
        type: 'trust',
        text: 'OAuth2 only. Your credentials stay with Google or Microsoft.',
      },
      visual: <OAuthFlow />,
      primaryLabel: 'Got it →',
    },
    {
      id: 4,
      type: 'spotlight',
      goToRoute: 'analyze',
      target: '[data-tour="time-range"]',
      preferredPlacement: 'bottom',
      kicker: 'Step 4 · Analyze',
      headline: 'Choose how far back to look',
      subtext:
        'Before analyzing your inbox, you pick a time window: 7 days, 30 days, 1 year, or all the way back to your first email. Larger ranges take longer but give you the full picture.',
      callout: {
        type: 'tip',
        text: "First time? Start with 1 year — best balance of speed and usefulness.",
      },
      visual: <TimeRangeMock />,
    },
    {
      id: 5,
      type: 'spotlight',
      goToRoute: 'analyze',
      target: '[data-tour="sync-drawer-anchor"]',
      preferredPlacement: 'top',
      kicker: 'Step 5',
      headline: 'Watch exactly what is happening',
      subtext:
        "While MailVault analyzes your emails, this drawer shows you every step in real time — what it fetched, what it found, what it's doing next. The rest of the app stays fully usable while this runs.",
      callout: {
        type: 'tip',
        text: 'Click the drawer header to expand or collapse it anytime (⌘J).',
      },
      visual: <SyncDrawerMock />,
    },
    {
      id: 6,
      type: 'spotlight',
      goToRoute: 'senders',
      target: '[data-tour="sender-grid"]',
      preferredPlacement: 'auto',
      kicker: 'Step 6 · Senders',
      headline: 'Emails grouped by who sent them',
      subtext:
        "Instead of showing individual emails, MailVault groups everything by sender. You'll see each sender's name, how many emails they sent you, and how much storage they're using.",
      callout: {
        type: 'tip',
        text: 'Sort by storage size to find the biggest space wasters fast.',
      },
      visual: <SenderRowMock />,
    },
    {
      id: 7,
      type: 'spotlight',
      goToRoute: 'senders',
      target: '[data-tour="sender-grid"]',
      preferredPlacement: 'auto',
      kicker: 'Step 7',
      headline: 'Select senders to clean up',
      subtext:
        "Check the box next to any sender to mark their emails for deletion. Select as many as you want, then click Review & Delete. You'll always review before anything is deleted — MailVault will never delete without your explicit confirmation.",
      callout: {
        type: 'safety',
        text: 'Deleted emails go to Trash first — not permanently deleted. You have time to recover anything by mistake.',
      },
      visual: <SelectAnimateMock />,
    },
    {
      id: 8,
      type: 'modal',
      kicker: 'Step 8',
      headline: 'You approve every deletion',
      subtext:
        'Before anything is deleted, you see a full summary grouped by sender. Each sender has an individual approve/reject toggle. Only approved senders get deleted when you hit confirm.',
      visual: <ConfirmPanelMock />,
    },
    {
      id: 9,
      type: 'spotlight',
      goToRoute: 'folders',
      target: '[data-tour="folders-panel"]',
      preferredPlacement: 'right',
      kicker: 'Step 9 · Folders',
      headline: 'Organize what you keep',
      subtext:
        'Not everything should be deleted. Create folders to organize emails you want to keep — receipts, newsletters, work threads. Select a sender group and use Move to folder to sort them.',
      callout: {
        type: 'tip',
        text: 'You can also rescue emails from Junk — select them and move to Inbox or any folder.',
      },
      visual: <FoldersHowTo />,
    },
    {
      id: 10,
      type: 'spotlight',
      goToRoute: 'rules',
      target: '[data-tour="nav-rules"]',
      preferredPlacement: 'right',
      kicker: 'Step 10',
      headline: 'Keep your inbox clean going forward',
      subtext:
        "Rules and blocking make sure the mess doesn't come back. Rules automatically label, move, or delete future emails based on sender, subject, or keywords. Blocking auto-deletes everything from a sender — and optionally purges their history.",
      visual: <RulesBlockingMock />,
    },
    {
      id: 11,
      type: 'modal',
      kicker: 'You are ready',
      headline: 'You know everything you need.',
      subtext: "Here's a quick cheat sheet to keep handy:",
      visual: <CheatSheet />,
      callout: {
        type: 'tip',
        text: 'Start with a 1-year sync on your most cluttered account. Most people delete 60–80% of what they find.',
      },
      primaryLabel: 'Start Analyzing →',
      primaryAction: opts.onFinishGoToAnalyze,
    },
  ];
}
