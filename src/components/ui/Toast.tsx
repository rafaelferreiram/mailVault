import { useEffect, useState } from 'react';
import { CheckCircle2, AlertTriangle, Info, RotateCcw, X } from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';

export function Toast() {
  const toast = useUIStore((s) => s.toast);
  const dismiss = useUIStore((s) => s.dismissToast);
  const pendingUndo = useUIStore((s) => s.pendingUndo);
  const setPendingUndo = useUIStore((s) => s.setPendingUndo);
  const showToast = useUIStore((s) => s.showToast);

  // Tick once per second for the countdown.
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!pendingUndo) return;
    const i = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(i);
  }, [pendingUndo]);

  useEffect(() => {
    if (!pendingUndo) return;
    if (now >= pendingUndo.expiresAt) setPendingUndo(null);
  }, [now, pendingUndo, setPendingUndo]);

  const onUndo = async () => {
    if (!pendingUndo) return;
    const u = pendingUndo;
    setPendingUndo(null);
    showToast('info', `Restoring ${u.count} email${u.count === 1 ? '' : 's'}…`);
    try {
      const result = await window.mailvault.restoreEmails(u.accountId, u.messageIds);
      showToast(
        result.failed === 0 ? 'ok' : 'err',
        `Restored ${result.restored}${result.failed ? ` · ${result.failed} failed` : ''}`
      );
    } catch (e) {
      showToast('err', `Undo failed: ${(e as Error).message}`);
    }
  };

  return (
    <>
      {pendingUndo && (
        <div className="fixed bottom-[var(--drawer-h,40px)] right-4 z-50 mb-3 animate-fade-in">
          <UndoToast
            count={pendingUndo.count}
            summary={pendingUndo.summary}
            remainingMs={Math.max(0, pendingUndo.expiresAt - now)}
            ttlMs={pendingUndo.expiresAt - pendingUndo.expiresAt + 30_000}
            onUndo={onUndo}
            onDismiss={() => setPendingUndo(null)}
          />
        </div>
      )}
      {toast && (
        <div
          className="fixed bottom-[var(--drawer-h,40px)] right-4 z-50 mb-3 animate-fade-in"
          style={{ marginBottom: pendingUndo ? 76 : undefined }}
        >
          <ToastInner kind={toast.kind} message={toast.message} onDismiss={dismiss} />
        </div>
      )}
    </>
  );
}

function ToastInner({
  kind,
  message,
  onDismiss,
}: {
  kind: 'ok' | 'err' | 'info';
  message: string;
  onDismiss: () => void;
}) {
  const Icon = kind === 'ok' ? CheckCircle2 : kind === 'err' ? AlertTriangle : Info;
  const color =
    kind === 'ok'
      ? 'text-ok border-ok/40'
      : kind === 'err'
      ? 'text-danger border-danger/40'
      : 'text-accent border-accent/40';
  return (
    <div
      className={`panel px-3 h-9 flex items-center gap-3 ${color} cursor-pointer min-w-[280px]`}
      onClick={onDismiss}
    >
      <Icon className="w-3.5 h-3.5 shrink-0" />
      <span className="text-xs text-fg flex-1">{message}</span>
      <X className="w-3 h-3 text-fg-subtle shrink-0" />
    </div>
  );
}

function UndoToast({
  count,
  summary,
  remainingMs,
  onUndo,
  onDismiss,
}: {
  count: number;
  summary: string;
  remainingMs: number;
  ttlMs: number;
  onUndo: () => void;
  onDismiss: () => void;
}) {
  const seconds = Math.ceil(remainingMs / 1000);
  const pct = Math.max(0, Math.min(1, remainingMs / 30_000));
  return (
    <div className="panel border-accent/30 px-3 py-2 min-w-[360px] relative overflow-hidden">
      <div className="flex items-center gap-3">
        <div className="w-1.5 h-1.5 bg-accent animate-pulse-soft" />
        <div className="flex-1">
          <div className="text-xs text-fg">
            {count} email{count === 1 ? '' : 's'} moved to Trash
          </div>
          <div className="text-[10px] font-mono text-fg-subtle uppercase tracking-wider">
            {summary}
          </div>
        </div>
        <button
          onClick={onUndo}
          className="btn btn-primary !h-7 !px-2.5 gap-1.5"
        >
          <RotateCcw className="w-3 h-3" />
          Undo · {seconds}s
        </button>
        <button
          onClick={onDismiss}
          className="text-fg-subtle hover:text-fg"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
      <div
        className="absolute bottom-0 left-0 h-px bg-accent transition-[width] ease-linear"
        style={{ width: `${pct * 100}%` }}
      />
    </div>
  );
}
