import type { ReactNode } from 'react';
import clsx from 'clsx';
import { IosToggle } from '@/components/Personalization/shared';

export function ControlBlock({
  label,
  children,
  disabled,
}: {
  label: string;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <div className={clsx('control-block', disabled && 'opacity-50 pointer-events-none')}>
      <div className="control-block__label">{label}</div>
      {children}
    </div>
  );
}

export function RadioPills<T extends string>({
  options,
  value,
  onChange,
  disabled,
}: {
  options: Array<{ id: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
  disabled?: boolean;
}) {
  return (
    <div className="radio-pill-row">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          disabled={disabled}
          className={clsx('radio-pill', value === o.id && 'radio-pill--on')}
          onClick={() => onChange(o.id)}
          aria-pressed={value === o.id}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export { IosToggle };

export function ReadingPaneIcon({ mode }: { mode: 'off' | 'right' | 'bottom' }) {
  const bar = 'bg-fg-dim rounded-sm';
  if (mode === 'off') {
    return (
      <div className="h-10 flex flex-col gap-1 justify-center px-2">
        <div className={`h-2 w-full ${bar}`} />
        <div className={`h-2 w-full ${bar}`} />
        <div className={`h-2 w-3/4 ${bar}`} />
      </div>
    );
  }
  if (mode === 'right') {
    return (
      <div className="h-10 flex gap-1 px-2">
        <div className="w-[30%] flex flex-col gap-1">
          <div className={`h-2 ${bar}`} />
          <div className={`h-2 ${bar}`} />
        </div>
        <div className={`flex-1 ${bar} opacity-70`} />
      </div>
    );
  }
  return (
    <div className="h-10 flex flex-col gap-1 px-2">
      <div className="h-[35%] flex flex-col gap-px">
        <div className={`h-1.5 flex-1 ${bar}`} />
        <div className={`h-1.5 flex-1 ${bar}`} />
      </div>
      <div className={`flex-1 ${bar} opacity-70`} />
    </div>
  );
}
