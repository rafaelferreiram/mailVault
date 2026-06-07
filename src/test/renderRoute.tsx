import { ReactNode } from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import { Analyze } from '@/components/Analyze';
import { Dashboard } from '@/components/Dashboard';
import { InboxCleaner } from '@/components/InboxCleaner';
import { Mailbox } from '@/components/Mailbox';
import { Folders } from '@/components/Folders';
import { Rules } from '@/components/Rules';
import { Blocked } from '@/components/Blocked';
import { Settings } from '@/components/Settings';
import { SuggestionFeed } from '@/components/Suggestions';
import { NotificationCenter } from '@/components/Notifications';
import type { Route } from '@/stores/uiStore';
import { resetTestStores, setTestRoute } from './testState';

const ROUTE_VIEWS: Record<Route, () => ReactNode> = {
  dashboard: () => <Dashboard />,
  suggestions: () => <SuggestionFeed />,
  analyze: () => <Analyze />,
  senders: () => <InboxCleaner />,
  mailbox: () => <Mailbox />,
  folders: () => <Folders />,
  rules: () => <Rules />,
  blocked: () => <Blocked />,
  settings: () => <Settings />,
  notifications: () => <NotificationCenter />,
};

export function renderRoute(route: Route, options?: RenderOptions) {
  resetTestStores();
  setTestRoute(route);
  document.documentElement.setAttribute('data-layout', 'master-detail');

  const View = ROUTE_VIEWS[route];
  return render(
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-bg">
      <div className="app-shell flex-1 flex min-h-0">
        <main className={`app-main flex-1 flex flex-col min-w-0 bg-bg route-${route}`}>
          <View />
        </main>
      </div>
    </div>,
    options
  );
}

export function renderInMain(route: Route, children: ReactNode, options?: RenderOptions) {
  resetTestStores();
  setTestRoute(route);
  return render(
    <main className={`app-main flex-1 flex flex-col min-w-0 route-${route}`}>{children}</main>,
    options
  );
}

export const ALL_ROUTES: Route[] = [
  'dashboard',
  'suggestions',
  'analyze',
  'senders',
  'mailbox',
  'folders',
  'rules',
  'blocked',
  'settings',
  'notifications',
];
