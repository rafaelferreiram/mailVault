import { Check, Minus } from 'lucide-react';
import clsx from 'clsx';

interface Props {
  checked: boolean | 'indeterminate';
  onChange: () => void;
  label?: string;
  size?: 'sm' | 'md';
}

export function Checkbox({ checked, onChange, label, size = 'md' }: Props) {
  const dim = size === 'sm' ? 12 : 14;
  return (
    <label className="inline-flex items-center gap-2 cursor-pointer select-none group">
      <span
        onClick={(e) => {
          e.preventDefault();
          onChange();
        }}
        className={clsx(
          'inline-flex items-center justify-center border transition-colors',
          checked
            ? 'bg-accent/20 border-accent text-accent'
            : 'bg-bg-inset border-border group-hover:border-border-strong'
        )}
        style={{ width: dim, height: dim }}
      >
        {checked === true && <Check className="w-2.5 h-2.5" strokeWidth={3} />}
        {checked === 'indeterminate' && <Minus className="w-2.5 h-2.5" strokeWidth={3} />}
      </span>
      {label && <span className="text-sm text-fg-muted">{label}</span>}
    </label>
  );
}
