import clsx from 'clsx';

type ResizeHandleProps = {
  side?: 'left' | 'right';
  className?: string;
} & Pick<
  React.HTMLAttributes<HTMLDivElement>,
  'onPointerDown' | 'onPointerMove' | 'onPointerUp' | 'onPointerCancel'
>;

export function ResizeHandle({
  side = 'right',
  className,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
}: ResizeHandleProps) {
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize panel"
      className={clsx(
        'absolute top-0 bottom-0 w-1.5 z-20 touch-none',
        side === 'right' ? 'right-0 cursor-col-resize' : 'left-0 cursor-col-resize',
        'hover:bg-accent/25 active:bg-accent/40 transition-colors',
        className
      )}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    />
  );
}
