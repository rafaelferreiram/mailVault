import { useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { Button } from './Button';

// Brand-aligned replacement for native `confirm()`. Keeps the
// terminal/panel aesthetic, traps Esc, and exposes destructive vs neutral
// styling. Closes audit P2-13.

interface Props {
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
  onCancel,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        void onConfirm();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel, onConfirm]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 animate-fade-in pt-[14vh]"
      onClick={onCancel}
      role="presentation"
    >
      <div
        className="panel w-full max-w-md mx-4 animate-fade-in"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
      >
        <div className="px-4 h-9 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle
              className={`w-3.5 h-3.5 ${destructive ? 'text-danger' : 'text-warn'}`}
            />
            <div
              id="confirm-modal-title"
              className="font-mono text-[11px] uppercase tracking-[0.16em] text-fg"
            >
              {title}
            </div>
          </div>
          <button
            onClick={onCancel}
            className="text-fg-subtle hover:text-fg"
            title="Close"
            aria-label="Close"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="px-4 py-4 text-[12px] text-fg leading-relaxed">{message}</div>
        <div className="px-4 py-3 border-t border-border flex items-center justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button
            size="sm"
            variant={destructive ? 'danger' : 'primary'}
            onClick={() => void onConfirm()}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
