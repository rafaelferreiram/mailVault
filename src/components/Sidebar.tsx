import { useMemo } from 'react';
import {
  LayoutGrid,
  Sparkles,
  Radar,
  Mails,
  FolderTree,
  SlidersHorizontal,
  ShieldBan,
  Settings as SettingsIcon,
  Palette,
} from 'lucide-react';
import clsx from 'clsx';
import { useUIStore, type Route } from '@/stores/uiStore';
import { usePrefsStore } from '@/stores/prefsStore';
import { useSyncStore } from '@/stores/syncStore';
import { useAccountsStore } from '@/stores/accountsStore';
import { SidebarFolders } from './Sidebar/SidebarFolders';
import { HelpPopover } from './HelpPopover';
import { LiveStatusIndicator } from './Notifications/LiveStatusIndicator';
import { Icon as UiIcon } from './ui/Icon';
import { ResizeHandle } from './ui/ResizeHandle';
import { formatBytes } from '@/lib/format';
import { useResizableWidth } from '@/hooks/useResizableWidth';

const NAV_CATALOG: Array<{
  id: Route;
  label: string;
  icon: typeof LayoutGrid;
  key: string;
}> = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutGrid, key: '1' },
  { id: 'suggestions', label: 'Suggestions', icon: Sparkles, key: '2' },
  { id: 'analyze', label: 'Analyze', icon: Radar, key: '3' },
  { id: 'senders', label: 'Senders', icon: Mails, key: '4' },
  { id: 'folders', label: 'Folders', icon: FolderTree, key: '5' },
  { id: 'rules', label: 'Rules', icon: SlidersHorizontal, key: '6' },
  { id: 'blocked', label: 'Blocked', icon: ShieldBan, key: '7' },
  { id: 'settings', label: 'Settings', icon: SettingsIcon, key: '8' },
];

export function Sidebar() {
  const route = useUIStore((s) => s.route);
  const setRoute = useUIStore((s) => s.setRoute);
  const togglePrefs = usePrefsStore((s) => s.togglePanel);
  const sidebarItems = usePrefsStore((s) => s.prefs.layout.sidebarItems);
  const showBadges = usePrefsStore((s) => s.prefs.panels.emailBadges);
  const showStorage = usePrefsStore((s) => s.prefs.panels.storageBar);
  const activeId = useAccountsStore((s) => s.activeId);
  const sync = useSyncStore((s) => (activeId ? s.byAccount[activeId] : null));

  const navItems = useMemo(() => {
    const meta = new Map(sidebarItems.map((i) => [i.id, i]));
    return NAV_CATALOG.filter((item) => meta.get(item.id)?.visible !== false).sort(
      (a, b) => (meta.get(a.id)?.order ?? 99) - (meta.get(b.id)?.order ?? 99)
    );
  }, [sidebarItems]);

  const messageCount = sync?.messages.length ?? 0;
  const storageBytes = sync?.stats.bytesAccounted ?? 0;
  const { width: sidebarWidth, resizeHandleProps } = useResizableWidth(
    'sidebar',
    240,
    180,
    420
  );

  return (
    <aside
      className="app-sidebar relative shrink-0 border-r border-border bg-bg-elevated flex flex-col h-full overflow-hidden"
      style={{ width: sidebarWidth }}
    >
      <nav className="px-2 pt-3 pb-2">
        <div className="sidebar-section-label label-mono px-2 mb-1.5">Navigate</div>
        <div className="space-y-px">
          {navItems.map((item) => {
            const active = route === item.id;
            const NavIcon = item.icon;
            return (
              <button
                key={item.id}
                data-tour={`nav-${item.id}`}
                onClick={() => setRoute(item.id)}
                className={clsx(
                  'sidebar-nav-btn w-full flex items-center justify-between px-2 text-[12px] transition-colors group border-l-2',
                  active
                    ? 'bg-accent/10 text-accent border-l-accent'
                    : 'text-fg-muted hover:text-fg hover:bg-bg-hover border-l-transparent'
                )}
                style={{ height: 'var(--sidebar-item-h, 28px)' }}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <UiIcon icon={NavIcon} size="sm" active={active} />
                  <span className="sidebar-nav-label truncate">{item.label}</span>
                  {showBadges && messageCount > 0 && item.id === 'senders' && (
                    <span className="text-[9px] font-mono text-fg-subtle tabular-nums">
                      {messageCount > 999 ? '999+' : messageCount}
                    </span>
                  )}
                </span>
                <span className="sidebar-nav-kbd kbd opacity-0 group-hover:opacity-100">
                  {item.key}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      <div className="sidebar-folders flex-1 min-h-0 flex flex-col overflow-hidden">
        <SidebarFolders />
      </div>

      {showStorage && storageBytes > 0 && (
        <div className="px-3 py-2 border-t border-border-subtle">
          <div className="flex items-center justify-between text-[9px] font-mono uppercase tracking-wider text-fg-subtle mb-1">
            <span>Storage mapped</span>
            <span className="text-fg-muted">{formatBytes(storageBytes)}</span>
          </div>
          <div className="h-1 bg-bg-hover overflow-hidden">
            <div
              className="h-full bg-accent transition-all"
              style={{ width: `${Math.min(100, (storageBytes / (5e9)) * 100)}%` }}
            />
          </div>
        </div>
      )}

      <div className="px-2 pt-1 pb-1 border-t border-border-subtle flex items-center gap-1">
        <div className="flex-1 min-w-0">
          <HelpPopover />
        </div>
        <button
          onClick={togglePrefs}
          title="Personalize (⌘,)"
          aria-label="Open personalization panel"
          className="shrink-0 w-7 h-7 flex items-center justify-center text-fg-muted hover:text-accent hover:bg-bg-hover transition-colors"
        >
          <UiIcon icon={Palette} size="sm" />
        </button>
      </div>

      <LiveStatusIndicator />

      <div className="px-3 py-2 border-t border-border-subtle">
        <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-widest text-fg-subtle">
          <span>v0.1.0</span>
        </div>
      </div>

      <ResizeHandle {...resizeHandleProps} />
    </aside>
  );
}
