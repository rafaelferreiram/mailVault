import { useState } from 'react';
import clsx from 'clsx';
import './appearance-settings.css';
import { ThemesSection } from './ThemesSection';
import { LayoutSection } from './LayoutSection';
import { EmailViewSection } from './EmailViewSection';
import { DensitySection } from './DensitySection';
import { AccentSection } from './AccentSection';
import { SidebarSection } from './SidebarSection';
import { MotionSection } from './MotionSection';
import { AdvancedSection } from './AdvancedSection';

export type AppearanceSection =
  | 'themes'
  | 'layout'
  | 'email-view'
  | 'density'
  | 'accent'
  | 'sidebar'
  | 'motion'
  | 'advanced';

const SECTIONS: Array<{ id: AppearanceSection; label: string }> = [
  { id: 'themes', label: 'Themes' },
  { id: 'layout', label: 'Layout' },
  { id: 'email-view', label: 'Email View' },
  { id: 'density', label: 'Density' },
  { id: 'accent', label: 'Accent Color' },
  { id: 'sidebar', label: 'Sidebar' },
  { id: 'motion', label: 'Motion' },
  { id: 'advanced', label: 'Advanced' },
];

export function AppearanceSettings() {
  const [section, setSection] = useState<AppearanceSection>('themes');

  return (
    <div className="appearance-settings -m-6 flex-1 min-h-0">
      <nav className="appearance-settings__rail" aria-label="Appearance sections">
        {SECTIONS.map((s) => {
          const active = section === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setSection(s.id)}
              className={clsx(
                'w-full text-left px-2.5 h-9 text-[12px] border-l-2 transition-colors mb-px',
                active
                  ? 'bg-accent/10 text-accent border-l-accent'
                  : 'text-fg-muted hover:text-fg hover:bg-bg-hover border-l-transparent'
              )}
            >
              {s.label}
            </button>
          );
        })}
      </nav>
      <div className="appearance-settings__content">
        {section === 'themes' && <ThemesSection />}
        {section === 'layout' && <LayoutSection />}
        {section === 'email-view' && <EmailViewSection />}
        {section === 'density' && <DensitySection />}
        {section === 'accent' && <AccentSection />}
        {section === 'sidebar' && <SidebarSection />}
        {section === 'motion' && <MotionSection />}
        {section === 'advanced' && <AdvancedSection />}
      </div>
    </div>
  );
}
