import { createContext, useContext, useCallback, useState, type ReactNode } from 'react';
import type { SettingsTab } from './settingsSearchIndex';

type ExpandedMap = Record<string, boolean>;

interface SettingsUiValue {
  expandedSections: ExpandedMap;
  toggleSection: (id: string) => void;
  expandSection: (id: string) => void;
  isExpanded: (id: string) => boolean;
  highlightSection: string | null;
  setHighlightSection: (id: string | null) => void;
  navigateToSection: (tab: SettingsTab, sectionId: string) => void;
  setActiveTab: (tab: SettingsTab) => void;
}

const SettingsUiContext = createContext<SettingsUiValue | null>(null);

const DEFAULT_EXPANDED: ExpandedMap = {
  'profile-identity': true,
  'profile-account': true,
  'profile-password': false,
  'profile-session': false,
  'general-deletion': true,
  'general-sync-limits': true,
  'general-security': true,
  'livesync-overview': true,
  'livesync-controls': true,
  'accounts-connected': true,
  'accounts-add': true,
  'help-actions': true,
  'appearance-themes': true,
  'appearance-layout': false,
  'appearance-email-view': false,
  'appearance-density': false,
  'appearance-accent': false,
  'appearance-sidebar': false,
  'appearance-motion': false,
  'appearance-advanced': false,
};

export function SettingsUiProvider({
  children,
  activeTab,
  setActiveTab,
}: {
  children: ReactNode;
  activeTab: SettingsTab;
  setActiveTab: (tab: SettingsTab) => void;
}) {
  const [expandedSections, setExpandedSections] = useState<ExpandedMap>(DEFAULT_EXPANDED);
  const [highlightSection, setHighlightSection] = useState<string | null>(null);

  const toggleSection = useCallback((id: string) => {
    setExpandedSections((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const expandSection = useCallback((id: string) => {
    setExpandedSections((prev) => ({ ...prev, [id]: true }));
  }, []);

  const isExpanded = useCallback(
    (id: string) => expandedSections[id] ?? true,
    [expandedSections]
  );

  const navigateToSection = useCallback(
    (tab: SettingsTab, sectionId: string) => {
      setActiveTab(tab);
      expandSection(sectionId);
      setHighlightSection(sectionId);
      window.setTimeout(() => {
        document
          .getElementById(`settings-section-${sectionId}`)
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 50);
      window.setTimeout(() => setHighlightSection(null), 2000);
    },
    [expandSection, setActiveTab]
  );

  return (
    <SettingsUiContext.Provider
      value={{
        expandedSections,
        toggleSection,
        expandSection,
        isExpanded,
        highlightSection,
        setHighlightSection,
        navigateToSection,
        setActiveTab,
      }}
    >
      {children}
    </SettingsUiContext.Provider>
  );
}

export function useSettingsUi() {
  const ctx = useContext(SettingsUiContext);
  if (!ctx) throw new Error('useSettingsUi must be used within SettingsUiProvider');
  return ctx;
}

/** Optional hook for components that may render outside Settings. */
export function useSettingsUiOptional() {
  return useContext(SettingsUiContext);
}
