import type {
  ContentLayout,
  LayoutPrefs,
  LayoutTemplate,
  SidebarPosition,
} from '@shared/types';

export const LAYOUT_TEMPLATE_CONFIG: Record<
  LayoutTemplate,
  { sidebarPosition: SidebarPosition; contentLayout: ContentLayout; sidebarCollapsed: boolean }
> = {
  classic: { sidebarPosition: 'left', contentLayout: 'single-pane', sidebarCollapsed: false },
  'master-detail': {
    sidebarPosition: 'left',
    contentLayout: 'master-detail',
    sidebarCollapsed: false,
  },
  focused: { sidebarPosition: 'compact', contentLayout: 'single-pane', sidebarCollapsed: true },
  'dashboard-first': {
    sidebarPosition: 'left',
    contentLayout: 'dashboard-first',
    sidebarCollapsed: false,
  },
  'right-panel': { sidebarPosition: 'right', contentLayout: 'single-pane', sidebarCollapsed: false },
  'three-column': {
    sidebarPosition: 'left',
    contentLayout: 'three-column',
    sidebarCollapsed: false,
  },
};

export function inferLayoutTemplate(layout: LayoutPrefs): LayoutTemplate {
  if (layout.template) return layout.template;
  if (layout.sidebarPosition === 'right') return 'right-panel';
  if (layout.sidebarPosition === 'compact') return 'focused';
  switch (layout.contentLayout) {
    case 'master-detail':
      return 'master-detail';
    case 'dashboard-first':
      return 'dashboard-first';
    case 'three-column':
      return 'three-column';
    default:
      return 'classic';
  }
}

export function layoutPrefsForTemplate(
  template: LayoutTemplate,
  current: LayoutPrefs
): LayoutPrefs {
  const cfg = LAYOUT_TEMPLATE_CONFIG[template];
  return {
    ...current,
    template,
    sidebarPosition: cfg.sidebarPosition,
    contentLayout: cfg.contentLayout,
    sidebarCollapsed: cfg.sidebarCollapsed,
  };
}
