import type { LucideIcon } from 'lucide-react';
import clsx from 'clsx';

/** MailVault icon scale — keep chrome icons on these sizes only. */
export type IconSize = 'xs' | 'sm' | 'md' | 'lg';

const SIZE_CLASS: Record<IconSize, string> = {
  xs: 'w-3 h-3', // 12px — micro inline (badges, kbd rows)
  sm: 'w-3.5 h-3.5', // 14px — top bar, sidebar nav, footer
  md: 'w-4 h-4', // 16px — panel headers, list rows
  lg: 'w-[18px] h-[18px]', // 18px — notification cards, modals
};

export interface IconProps {
  icon: LucideIcon;
  size?: IconSize;
  /** Slightly heavier stroke for active/selected nav items. */
  active?: boolean;
  spin?: boolean;
  className?: string;
}

/**
 * Thin wrapper around Lucide icons so stroke weight and size stay consistent
 * across the chrome (TopBar, Sidebar, notifications, help menu).
 */
export function Icon({
  icon: Comp,
  size = 'sm',
  active = false,
  spin = false,
  className,
}: IconProps) {
  return (
    <Comp
      className={clsx(SIZE_CLASS[size], 'shrink-0', spin && 'animate-spin', className)}
      strokeWidth={active ? 2.15 : 1.75}
      aria-hidden
    />
  );
}

/** Shared class for icon-only top-bar utility buttons (bell, density, shortcuts). */
export const topBarIconBtn =
  'h-7 w-7 flex items-center justify-center border border-border text-fg-muted hover:text-fg hover:bg-bg-hover transition-colors';

export const topBarIconBtnActive =
  'h-7 w-7 flex items-center justify-center border border-accent/40 text-accent bg-accent/5 transition-colors';
