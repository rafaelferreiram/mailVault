import { PANEL_TOGGLES, THEMES } from '@/components/Personalization/shared';
import { LAYOUT_OPTIONS } from './AppearanceSettings/LayoutDiagrams';

export type SettingsTab =
  | 'profile'
  | 'general'
  | 'live-sync'
  | 'appearance'
  | 'accounts'
  | 'help';

export interface SettingsSearchEntry {
  id: string;
  tab: SettingsTab;
  sectionId: string;
  title: string;
  description: string;
  keywords: string[];
  tabLabel: string;
}

const TAB_LABELS: Record<SettingsTab, string> = {
  profile: 'Profile',
  general: 'General',
  'live-sync': 'Live sync',
  appearance: 'Appearance',
  accounts: 'Email accounts',
  help: 'Help',
};

function entry(
  partial: Omit<SettingsSearchEntry, 'tabLabel'> & { tab: SettingsTab }
): SettingsSearchEntry {
  return { ...partial, tabLabel: TAB_LABELS[partial.tab] };
}

export const SETTINGS_SEARCH_INDEX: SettingsSearchEntry[] = [
  entry({
    id: 'profile-name',
    tab: 'profile',
    sectionId: 'profile-identity',
    title: 'Your name',
    description: 'How you appear inside MailVault',
    keywords: ['name', 'profile', 'display', 'identity'],
  }),
  entry({
    id: 'profile-avatar',
    tab: 'profile',
    sectionId: 'profile-identity',
    title: 'Profile photo or emoji',
    description: 'Avatar shown in the app header',
    keywords: ['avatar', 'photo', 'emoji', 'picture', 'profile'],
  }),
  entry({
    id: 'profile-mailvault-account',
    tab: 'profile',
    sectionId: 'profile-account',
    title: 'MailVault account',
    description: 'Username and recovery email',
    keywords: ['username', 'account', 'mailvault', 'recovery', 'email'],
  }),
  entry({
    id: 'profile-password',
    tab: 'profile',
    sectionId: 'profile-password',
    title: 'Change MailVault password',
    description: 'Update your local sign-in password',
    keywords: ['password', 'change', 'security', 'login', 'mailvault'],
  }),
  entry({
    id: 'profile-signout',
    tab: 'profile',
    sectionId: 'profile-session',
    title: 'Sign out',
    description: 'Sign out of MailVault on this device',
    keywords: ['sign out', 'logout', 'session'],
  }),
  entry({
    id: 'accounts-label',
    tab: 'accounts',
    sectionId: 'accounts-connected',
    title: 'Edit account label',
    description: 'Rename a linked Gmail or Outlook account in MailVault',
    keywords: ['rename', 'label', 'name', 'account', 'email'],
  }),
  entry({
    id: 'deletion-trash',
    tab: 'general',
    sectionId: 'general-deletion',
    title: 'Move to Trash',
    description: 'Recoverable deletion with undo support',
    keywords: ['delete', 'trash', 'recover', 'undo', 'deletion'],
  }),
  entry({
    id: 'deletion-permanent',
    tab: 'general',
    sectionId: 'general-deletion',
    title: 'Permanent delete',
    description: 'Bypass trash — cannot be recovered',
    keywords: ['delete', 'permanent', 'erase', 'deletion'],
  }),
  entry({
    id: 'sync-max',
    tab: 'general',
    sectionId: 'general-sync-limits',
    title: 'Max messages per sync',
    description: 'Limit for full analysis on the Analyze page',
    keywords: ['sync', 'limit', 'messages', 'fetch', 'analyze', 'max'],
  }),
  entry({
    id: 'security-oauth',
    tab: 'general',
    sectionId: 'general-security',
    title: 'Security & privacy',
    description: 'OAuth tokens, keychain, sandbox',
    keywords: ['security', 'oauth', 'keychain', 'token', 'privacy', 'sandbox'],
  }),
  entry({
    id: 'livesync-overview',
    tab: 'live-sync',
    sectionId: 'livesync-overview',
    title: 'Background watching',
    description: 'Poll Inbox and Junk on linked accounts',
    keywords: ['live', 'sync', 'inbox', 'junk', 'spam', 'watch', 'background'],
  }),
  entry({
    id: 'livesync-enable',
    tab: 'live-sync',
    sectionId: 'livesync-controls',
    title: 'Enable live sync',
    description: 'Turn background mail watching on or off',
    keywords: ['live', 'sync', 'enable', 'toggle', 'watching'],
  }),
  entry({
    id: 'livesync-interval',
    tab: 'live-sync',
    sectionId: 'livesync-controls',
    title: 'Check interval',
    description: 'How often to poll for new mail',
    keywords: ['interval', 'polling', 'frequency', '30s', '1m', '5m'],
  }),
  entry({
    id: 'livesync-adaptive',
    tab: 'live-sync',
    sectionId: 'livesync-controls',
    title: 'Adaptive polling',
    description: 'Poll faster when mail is active',
    keywords: ['adaptive', 'polling', 'smart'],
  }),
  entry({
    id: 'livesync-auto-rules',
    tab: 'live-sync',
    sectionId: 'livesync-controls',
    title: 'Apply existing rules',
    description: 'Auto-apply rules without approval',
    keywords: ['rules', 'auto', 'filter'],
  }),
  entry({
    id: 'livesync-auto-block',
    tab: 'live-sync',
    sectionId: 'livesync-controls',
    title: 'Block listed senders',
    description: 'Auto-block senders on your block list',
    keywords: ['block', 'sender', 'auto'],
  }),
  entry({
    id: 'livesync-auto-archive',
    tab: 'live-sync',
    sectionId: 'livesync-controls',
    title: 'Auto-archive newsletters',
    description: 'Archive newsletter mail automatically',
    keywords: ['newsletter', 'archive', 'auto'],
  }),
  entry({
    id: 'livesync-notifications',
    tab: 'live-sync',
    sectionId: 'livesync-controls',
    title: 'Live sync notifications',
    description: 'Badge, bell, and approval popups',
    keywords: ['notification', 'badge', 'bell', 'popup', 'alert'],
  }),
  ...THEMES.map((t) =>
    entry({
      id: `theme-${t.id}`,
      tab: 'appearance',
      sectionId: 'appearance-themes',
      title: `${t.label} theme`,
      description: t.tag,
      keywords: ['theme', 'color', 'appearance', t.id, t.label.toLowerCase(), t.tag.toLowerCase()],
    })
  ),
  ...LAYOUT_OPTIONS.map((l) =>
    entry({
      id: `layout-${l.id}`,
      tab: 'appearance',
      sectionId: 'appearance-layout',
      title: `${l.name} layout`,
      description: l.description,
      keywords: ['layout', 'template', l.id, l.name.toLowerCase()],
    })
  ),
  entry({
    id: 'email-reading-pane',
    tab: 'appearance',
    sectionId: 'appearance-email-view',
    title: 'Reading pane',
    description: 'Off, right, or bottom preview layout',
    keywords: ['reading', 'pane', 'preview', 'email', 'view'],
  }),
  entry({
    id: 'email-list-density',
    tab: 'appearance',
    sectionId: 'appearance-email-view',
    title: 'Email list density',
    description: 'Comfortable, compact, or condensed rows',
    keywords: ['density', 'list', 'compact', 'comfortable', 'email'],
  }),
  entry({
    id: 'email-avatars',
    tab: 'appearance',
    sectionId: 'appearance-email-view',
    title: 'Sender avatars',
    description: 'Show avatars in the message list',
    keywords: ['avatar', 'sender', 'photo'],
  }),
  entry({
    id: 'email-thread-group',
    tab: 'appearance',
    sectionId: 'appearance-email-view',
    title: 'Group by thread',
    description: 'Collapse conversation threads in the list',
    keywords: ['thread', 'conversation', 'group'],
  }),
  entry({
    id: 'density-global',
    tab: 'appearance',
    sectionId: 'appearance-density',
    title: 'App density',
    description: 'Compact, normal, or spacious spacing',
    keywords: ['density', 'spacing', 'compact', 'spacious'],
  }),
  entry({
    id: 'accent-color',
    tab: 'appearance',
    sectionId: 'appearance-accent',
    title: 'Accent color',
    description: 'Highlight color for buttons and selection',
    keywords: ['accent', 'color', 'highlight', 'cyan', 'violet'],
  }),
  entry({
    id: 'sidebar-position',
    tab: 'appearance',
    sectionId: 'appearance-sidebar',
    title: 'Sidebar position',
    description: 'Left, right, or compact icon navigation',
    keywords: ['sidebar', 'navigation', 'left', 'right', 'compact'],
  }),
  ...PANEL_TOGGLES.map((p) =>
    entry({
      id: `panel-${p.key}`,
      tab: 'appearance',
      sectionId: 'appearance-sidebar',
      title: p.label,
      description: 'Toggle sidebar panel visibility',
      keywords: ['panel', 'sidebar', p.label.toLowerCase(), p.key],
    })
  ),
  entry({
    id: 'motion-speed',
    tab: 'appearance',
    sectionId: 'appearance-motion',
    title: 'Animation speed',
    description: 'Instant, normal, or slow transitions',
    keywords: ['motion', 'animation', 'speed', 'transition'],
  }),
  entry({
    id: 'motion-reduce',
    tab: 'appearance',
    sectionId: 'appearance-motion',
    title: 'Reduce motion',
    description: 'Disable animations for accessibility',
    keywords: ['reduce', 'motion', 'accessibility', 'animation'],
  }),
  entry({
    id: 'interface-style',
    tab: 'appearance',
    sectionId: 'appearance-advanced',
    title: 'Interface style',
    description: 'Minimal, focused, detailed, editorial, warm',
    keywords: ['style', 'interface', 'typography', 'minimal', 'focused'],
  }),
  entry({
    id: 'custom-css',
    tab: 'appearance',
    sectionId: 'appearance-advanced',
    title: 'Custom CSS',
    description: 'Inject optional CSS overrides',
    keywords: ['css', 'custom', 'override', 'advanced'],
  }),
  entry({
    id: 'accounts-list',
    tab: 'accounts',
    sectionId: 'accounts-connected',
    title: 'Linked email accounts',
    description: 'Gmail and Outlook accounts connected to MailVault',
    keywords: ['account', 'gmail', 'outlook', 'connect', 'email', 'oauth'],
  }),
  entry({
    id: 'accounts-add',
    tab: 'accounts',
    sectionId: 'accounts-add',
    title: 'Add account',
    description: 'Link another Gmail or Outlook mailbox',
    keywords: ['add', 'connect', 'login', 'account', 'link'],
  }),
  entry({
    id: 'help-tour',
    tab: 'help',
    sectionId: 'help-actions',
    title: 'Restart onboarding tour',
    description: 'Walk through MailVault features',
    keywords: ['tour', 'onboarding', 'guide', 'help'],
  }),
  entry({
    id: 'help-shortcuts',
    tab: 'help',
    sectionId: 'help-actions',
    title: 'Keyboard shortcuts',
    description: 'View all navigation and action keys',
    keywords: ['keyboard', 'shortcuts', 'keys', 'hotkey'],
  }),
  entry({
    id: 'help-whats-new',
    tab: 'help',
    sectionId: 'help-actions',
    title: "What's new",
    description: 'Latest MailVault updates',
    keywords: ['whats new', 'updates', 'changelog', 'release'],
  }),
  entry({
    id: 'help-feedback',
    tab: 'help',
    sectionId: 'help-actions',
    title: 'Send feedback',
    description: 'Report a problem or suggest an improvement',
    keywords: ['feedback', 'bug', 'report', 'email', 'support'],
  }),
];

export function searchSettings(query: string, limit = 12): SettingsSearchEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const scored = SETTINGS_SEARCH_INDEX.map((entry) => {
    let score = 0;
    const title = entry.title.toLowerCase();
    const desc = entry.description.toLowerCase();

    if (title === q) score += 100;
    else if (title.startsWith(q)) score += 60;
    else if (title.includes(q)) score += 40;

    if (desc.includes(q)) score += 20;

    for (const kw of entry.keywords) {
      if (kw === q) score += 50;
      else if (kw.startsWith(q)) score += 25;
      else if (kw.includes(q)) score += 10;
    }

    if (entry.tabLabel.toLowerCase().includes(q)) score += 8;

    return { entry, score };
  })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  const seen = new Set<string>();
  const out: SettingsSearchEntry[] = [];
  for (const { entry } of scored) {
    const key = `${entry.sectionId}:${entry.title}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(entry);
    if (out.length >= limit) break;
  }
  return out;
}
