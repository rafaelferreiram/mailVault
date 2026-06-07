import clsx from 'clsx';

/** iOS Settings–style switch track and knob. */
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
  const track =
    size === 'sm'
      ? 'w-[42px] h-[26px]'
      : 'w-[51px] h-[31px]';
  const knob =
    size === 'sm'
      ? 'w-[22px] h-[22px] top-[2px]'
      : 'w-[27px] h-[27px] top-[2px]';
  const knobOn =
    size === 'sm' ? 'translate-x-[18px]' : 'translate-x-[22px]';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel ?? 'Toggle'}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={clsx(
        'relative inline-flex shrink-0 rounded-full transition-colors duration-200 ease-in-out',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent/40',
        track,
        disabled && 'opacity-40 cursor-not-allowed',
        checked ? 'bg-[#34C759]' : 'bg-[rgb(120_120_128/0.32)]'
      )}
    >
      <span
        className={clsx(
          'absolute left-0 rounded-full bg-white transition-transform duration-200 ease-in-out',
          'shadow-[0_3px_8px_rgba(0,0,0,0.15),0_3px_1px_rgba(0,0,0,0.06)]',
          knob,
          checked ? knobOn : 'translate-x-[2px]'
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
        'flex items-center gap-3 min-h-[44px] py-1 cursor-pointer group',
        label ? 'justify-between' : 'justify-end',
        disabled && 'opacity-50 pointer-events-none'
      )}
    >
      {label ? (
        <span className="text-[13px] text-fg group-hover:text-fg leading-snug pr-2">{label}</span>
      ) : null}
      <Switch checked={checked} onChange={onChange} disabled={disabled} aria-label={label} />
    </label>
  );
}
