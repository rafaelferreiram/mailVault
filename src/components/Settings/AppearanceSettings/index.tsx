import { useRef } from 'react';
import { SettingsCollapsibleSection } from '../SettingsCollapsibleSection';
import { ThemesSection } from './ThemesSection';
import { LayoutSection } from './LayoutSection';
import { EmailViewSection } from './EmailViewSection';
import { DensitySection } from './DensitySection';
import { AccentSection } from './AccentSection';
import { SidebarSection } from './SidebarSection';
import { MotionSection } from './MotionSection';
import { AdvancedSection } from './AdvancedSection';

export function AppearanceSettings() {
  return (
    <div className="page-content pb-8">
      <div className="settings-stack">
        <SettingsCollapsibleSection
          id="appearance-themes"
          title="Themes"
          subtitle="Hover to preview on the live app. Click to keep your choice."
        >
          <ThemesSection />
        </SettingsCollapsibleSection>

        <SettingsCollapsibleSection
          id="appearance-layout"
          title="Layout template"
          subtitle="Choose how MailVault arranges its panels."
        >
          <LayoutSection />
        </SettingsCollapsibleSection>

        <SettingsCollapsibleSection
          id="appearance-email-view"
          title="Email view"
          subtitle="Reading pane, list density, and preview options."
        >
          <EmailViewSection />
        </SettingsCollapsibleSection>

        <SettingsCollapsibleSection
          id="appearance-density"
          title="Density"
          subtitle="Spacing across lists, panels, and cards."
        >
          <DensitySection />
        </SettingsCollapsibleSection>

        <SettingsCollapsibleSection
          id="appearance-accent"
          title="Accent color"
          subtitle="Highlights buttons, selection borders, and active navigation."
        >
          <AccentSection />
        </SettingsCollapsibleSection>

        <SettingsCollapsibleSection
          id="appearance-sidebar"
          title="Sidebar"
          subtitle="Navigation rail position and visible chrome panels."
        >
          <SidebarSection />
        </SettingsCollapsibleSection>

        <SettingsCollapsibleSection
          id="appearance-motion"
          title="Motion"
          subtitle="Animation speed and reduce-motion override."
        >
          <MotionSection />
        </SettingsCollapsibleSection>

        <SettingsCollapsibleSection
          id="appearance-advanced"
          title="Advanced"
          subtitle="Interface style presets, custom CSS, and reset options."
        >
          <AdvancedSection />
        </SettingsCollapsibleSection>
      </div>
    </div>
  );
}
