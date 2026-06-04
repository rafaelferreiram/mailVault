import clsx from 'clsx';

export function Switch({
  checked,
  onChange,
  disabled,
  size = 'md',
  'aria-label': ariaLabel,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  size?: 'sm' | 'md';
  'aria-label'?: string;
}) {
  const w = size === 'sm' ? 'w-8 h-[18px]' : 'w-10 h-[22px]';
  const knob = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4';
  const onX = size === 'sm' ? 'translate-x-[14px]' : 'translate-x-[18px]';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel ?? 'Toggle'}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={clsx(
        'relative rounded-full border transition-all duration-200 shrink-0',
        w,
        disabled && 'opacity-40 cursor-not-allowed',
        checked
          ? 'bg-accent/25 border-accent/60 shadow-[0_0_12px_rgb(var(--color-accent)/0.25)]'
          : 'bg-bg-inset border-border hover:border-border-strong'
      )}
    >
      <span
        className={clsx(
          'absolute top-1/2 -translate-y-1/2 rounded-full transition-all duration-200 shadow-sm',
          knob,
          checked ? `${onX} bg-accent` : 'translate-x-0.5 bg-fg-muted'
        )}
      />
    </button>
  );
}

export function IosToggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
  disabled?: boolean;
}) {
  return (
    <label
      className={clsx(
        'flex items-center gap-3 py-2 cursor-pointer group',
        label ? 'justify-between' : 'justify-end',
        disabled && 'opacity-50 pointer-events-none'
      )}
    >
      {label ? (
        <span className="text-[12px] text-fg group-hover:text-fg leading-snug">{label}</span>
      ) : null}
      <Switch checked={checked} onChange={onChange} disabled={disabled} aria-label={label} />
    </label>
  );
}
