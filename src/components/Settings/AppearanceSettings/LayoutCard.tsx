import clsx from 'clsx';
import { Check } from 'lucide-react';
import type { LayoutTemplate } from '@shared/types';
import { LayoutDiagram } from './LayoutDiagrams';

export interface LayoutCardProps {
  id: LayoutTemplate;
  name: string;
  description: string;
  selected: boolean;
  disabled?: boolean;
  onSelect: (id: LayoutTemplate) => void;
}

export function LayoutCard({
  id,
  name,
  description,
  selected,
  disabled,
  onSelect,
}: LayoutCardProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onSelect(id)}
      className={clsx('layout-card relative', selected && 'layout-card--selected')}
      aria-pressed={selected}
    >
      {selected && (
        <span className="check-badge" aria-hidden>
          <Check className="w-3 h-3" strokeWidth={3} />
        </span>
      )}
      <div className="layout-card__diagram">
        <LayoutDiagram id={id} />
      </div>
      <div className="layout-card__meta">
        <div className="layout-card__name">{name}</div>
        <div className="layout-card__desc">{description}</div>
      </div>
    </button>
  );
}
