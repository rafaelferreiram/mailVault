import type { ReactNode } from 'react';
import clsx from 'clsx';
import { ChevronRight } from 'lucide-react';
import { useSettingsUiOptional } from './SettingsUiContext';

interface Props {
  id: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
  /** When true, section manages its own expand state (standalone use). */
  standalone?: boolean;
  defaultExpanded?: boolean;
}

export function SettingsCollapsibleSection({
  id,
  title,
  subtitle,
  children,
  standalone = false,
  defaultExpanded = true,
}: Props) {
  const ui = useSettingsUiOptional();
  const expanded = standalone ? defaultExpanded : (ui?.isExpanded(id) ?? defaultExpanded);
  const highlighted = ui?.highlightSection === id;

  const onToggle = () => {
    if (standalone || !ui) return;
    ui.toggleSection(id);
  };

  return (
    <section
      id={`settings-section-${id}`}
      className={clsx(
        'settings-section panel overflow-hidden',
        highlighted && 'settings-section--highlight'
      )}
    >
      <button
        type="button"
        className="settings-section__header w-full text-left"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={`settings-section-body-${id}`}
        disabled={standalone}
      >
        <ChevronRight
          className={clsx(
            'settings-section__chevron shrink-0 transition-transform duration-200',
            expanded && 'rotate-90'
          )}
        />
        <div className="min-w-0 flex-1">
          <h3 className="settings-section__title">{title}</h3>
          {subtitle && <p className="settings-section__subtitle">{subtitle}</p>}
        </div>
      </button>
      {expanded && (
        <div id={`settings-section-body-${id}`} className="settings-section__body">
          {children}
        </div>
      )}
    </section>
  );
}
