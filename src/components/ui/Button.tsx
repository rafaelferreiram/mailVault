import { ButtonHTMLAttributes, ReactNode } from 'react';
import clsx from 'clsx';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'ok';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
  uppercase?: boolean;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  iconLeft,
  iconRight,
  uppercase = true,
  className,
  children,
  ...rest
}: Props) {
  return (
    <button
      {...rest}
      className={clsx(
        'btn',
        variant === 'primary' && 'btn-primary',
        variant === 'secondary' && 'btn-secondary',
        variant === 'ghost' && 'btn-ghost',
        variant === 'danger' && 'btn-danger',
        variant === 'ok' && 'btn-ok',
        size === 'xs' && 'h-6 px-2 text-[10px]',
        size === 'sm' && 'h-7 px-2.5',
        size === 'lg' && 'h-9 px-4 text-xs',
        !uppercase && 'normal-case tracking-normal',
        className
      )}
    >
      {iconLeft}
      {children}
      {iconRight}
    </button>
  );
}
